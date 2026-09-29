import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WEBSITE_ANALYTICS_ERROR_CODES,
  type WEBSITE_ANALYTICS_CONNECT_FAILURES,
  type SelectWebsiteAnalyticsPropertyInput,
  type WebsiteAnalyticsDataStreamList,
  type WebsiteAnalyticsIntegrationStatus,
  type WebsiteAnalyticsPropertyTree,
  type WebsiteAnalyticsReport,
  type WebsiteAnalyticsReportRange,
} from '@churchflow/shared';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-box';
import {
  GoogleAnalyticsClient,
  GoogleApiError,
  lastResourceSegment,
  type GoogleTokenResponse,
} from './google/google-analytics.client';
import { buildReportRequests, toWebsiteAnalyticsReport } from './google/google-analytics-report';
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthChallenge,
  grantsAnalyticsScope,
  readIdTokenEmail,
  statesMatch,
} from './google/google-oauth';
import { WebsiteAnalyticsRepository } from './repositories/website-analytics.repository';

const REPORT_CACHE_TTL_MS = 10 * 60 * 1000;
// Refresh a little before Google's expiry so a token never lapses mid-request.
const ACCESS_TOKEN_SAFETY_MS = 60 * 1000;

type StoredIntegration = NonNullable<
  Awaited<ReturnType<WebsiteAnalyticsRepository['findByOrganizationId']>>
>;

export interface GoogleOAuthFlowState {
  organizationId: string;
  state: string;
  codeVerifier: string;
}

export type GoogleOAuthCompletion =
  | { ok: true }
  | { ok: false; reason: (typeof WEBSITE_ANALYTICS_CONNECT_FAILURES)[number] };

@Injectable()
export class WebsiteAnalyticsService {
  private readonly logger = new Logger(WebsiteAnalyticsService.name);
  private readonly accessTokens = new Map<
    string,
    { encryptedRefreshToken: string; token: string; expiresAt: number }
  >();
  private readonly reports = new Map<
    string,
    { report: WebsiteAnalyticsReport; expiresAt: number }
  >();

  constructor(
    private readonly repository: WebsiteAnalyticsRepository,
    private readonly google: GoogleAnalyticsClient,
    private readonly config: ConfigService,
  ) {}

  get oauthAvailable(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID') &&
      this.config.get<string>('GOOGLE_OAUTH_CLIENT_SECRET') &&
      this.config.get<string>('GOOGLE_ANALYTICS_REDIRECT_URI') &&
      this.config.get<string>('INTEGRATION_ENCRYPTION_KEY'),
    );
  }

  async getStatus(organizationId: string): Promise<WebsiteAnalyticsIntegrationStatus> {
    const integration = await this.repository.findByOrganizationId(organizationId);

    return {
      oauthAvailable: this.oauthAvailable,
      integration: integration
        ? {
            mode: integration.mode,
            status: integration.status,
            measurementId: integration.measurementId,
            googleAccountEmail: integration.googleAccountEmail,
            propertyId: integration.propertyId,
            propertyDisplayName: integration.propertyDisplayName,
            streamId: integration.streamId,
            updatedAt: integration.updatedAt.toISOString(),
          }
        : null,
    };
  }

  beginOAuth(organizationId: string): { authorizationUrl: string; flow: GoogleOAuthFlowState } {
    this.assertOAuthAvailable();
    const challenge = createGoogleOAuthChallenge();

    return {
      authorizationUrl: buildGoogleAuthorizationUrl({
        clientId: this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
        redirectUri: this.config.getOrThrow<string>('GOOGLE_ANALYTICS_REDIRECT_URI'),
        state: challenge.state,
        codeChallenge: challenge.codeChallenge,
      }),
      flow: {
        organizationId,
        state: challenge.state,
        codeVerifier: challenge.codeVerifier,
      },
    };
  }

  /**
   * Finishes the Google consent round trip for an owner the route guard already admitted to this
   * organization. The flow cookie proves this browser started it.
   */
  async completeOAuth(input: {
    actorUserId: string;
    flow: GoogleOAuthFlowState;
    code: string | undefined;
    state: string | undefined;
    error: string | undefined;
  }): Promise<GoogleOAuthCompletion> {
    const { actorUserId, flow } = input;
    if (!this.oauthAvailable) return { ok: false, reason: 'unavailable' };
    if (input.error) return { ok: false, reason: 'denied' };
    if (!input.code || !input.state || !statesMatch(input.state, flow.state)) {
      return { ok: false, reason: 'expired' };
    }

    let tokens: GoogleTokenResponse;
    try {
      tokens = await this.google.exchangeCode({
        code: input.code,
        codeVerifier: flow.codeVerifier,
        redirectUri: this.config.getOrThrow<string>('GOOGLE_ANALYTICS_REDIRECT_URI'),
      });
    } catch (error) {
      this.logger.warn(`Google Analytics code exchange failed: ${describeError(error)}`);
      return { ok: false, reason: 'exchange' };
    }

    if (!grantsAnalyticsScope(tokens.scope)) {
      await this.google.revokeToken(tokens.refresh_token ?? tokens.access_token);
      return { ok: false, reason: 'scope' };
    }
    if (!tokens.refresh_token) {
      this.logger.warn('Google Analytics consent returned no refresh token');
      return { ok: false, reason: 'exchange' };
    }

    const encryptedRefreshToken = encryptSecret(tokens.refresh_token, this.encryptionKey());
    const googleAccountEmail = readIdTokenEmail(tokens.id_token);
    const previous = await this.repository.findByOrganizationId(flow.organizationId);
    await this.repository.connectOAuth({
      organizationId: flow.organizationId,
      actorUserId,
      encryptedRefreshToken,
      googleAccountEmail,
    });
    this.accessTokens.set(flow.organizationId, {
      encryptedRefreshToken,
      token: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000 - ACCESS_TOKEN_SAFETY_MS,
    });
    this.forgetReports(flow.organizationId);
    // Switching Google accounts leaves the old account's grant live at Google with nothing here
    // referring to it. The same account is left alone: Google revokes a user's whole grant for
    // this client, so revoking its old token would revoke the one just issued as well.
    if (
      previous?.googleAccountEmail &&
      googleAccountEmail &&
      previous.googleAccountEmail !== googleAccountEmail
    ) {
      await this.revokeStoredGrant(previous);
    }

    return { ok: true };
  }

  async listProperties(organizationId: string): Promise<WebsiteAnalyticsPropertyTree> {
    const integration = await this.requireOAuthIntegration(organizationId);
    const accounts = await this.withGoogle(integration, async () =>
      this.google.listAccountSummaries(await this.accessToken(integration)),
    );

    return {
      accounts: accounts.map((account) => ({
        id: lastResourceSegment(account.account),
        displayName: account.displayName,
        properties: account.propertySummaries.map((property) => ({
          id: lastResourceSegment(property.property),
          displayName: property.displayName,
        })),
      })),
    };
  }

  async listDataStreams(
    organizationId: string,
    propertyId: string,
  ): Promise<WebsiteAnalyticsDataStreamList> {
    const integration = await this.requireOAuthIntegration(organizationId);
    const dataStreams = await this.withGoogle(integration, async () =>
      this.google.listWebDataStreams(await this.accessToken(integration), propertyId),
    );

    return { dataStreams };
  }

  /**
   * The ids come from the browser, so the property and stream are looked up again through the
   * connected account: an owner can only select what that Google account can actually read.
   */
  async selectProperty(
    organizationId: string,
    actorUserId: string,
    input: SelectWebsiteAnalyticsPropertyInput,
  ): Promise<WebsiteAnalyticsIntegrationStatus> {
    const integration = await this.requireOAuthIntegration(organizationId);
    const { accounts, streams } = await this.withGoogle(integration, async () => {
      const token = await this.accessToken(integration);
      const [accountSummaries, dataStreams] = await Promise.all([
        this.google.listAccountSummaries(token),
        this.google.listWebDataStreams(token, input.propertyId),
      ]);
      return { accounts: accountSummaries, streams: dataStreams };
    });

    const account = accounts.find((summary) =>
      summary.propertySummaries.some(
        (property) => lastResourceSegment(property.property) === input.propertyId,
      ),
    );
    const property = account?.propertySummaries.find(
      (summary) => lastResourceSegment(summary.property) === input.propertyId,
    );
    const stream = streams.find((dataStream) => dataStream.id === input.streamId);
    if (!account || !property || !stream) {
      throw new NotFoundException('The selected Google Analytics property or stream was not found');
    }

    await this.repository.selectProperty({
      organizationId,
      actorUserId,
      gaAccountId: lastResourceSegment(account.account),
      propertyId: input.propertyId,
      propertyDisplayName: property.displayName,
      streamId: stream.id,
      measurementId: stream.measurementId,
    });
    this.forgetReports(organizationId);

    return this.getStatus(organizationId);
  }

  async setManualMeasurementId(
    organizationId: string,
    actorUserId: string,
    measurementId: string,
  ): Promise<WebsiteAnalyticsIntegrationStatus> {
    const previous = await this.repository.findByOrganizationId(organizationId);
    await this.repository.setManualMeasurementId({ organizationId, actorUserId, measurementId });
    this.forgetOrganization(organizationId);
    await this.revokeStoredGrant(previous);

    return this.getStatus(organizationId);
  }

  async disconnect(
    organizationId: string,
    actorUserId: string,
  ): Promise<WebsiteAnalyticsIntegrationStatus> {
    const previous = await this.repository.findByOrganizationId(organizationId);
    if (!previous) throw this.notConnected();

    await this.repository.disconnect({ organizationId, actorUserId });
    this.forgetOrganization(organizationId);
    await this.revokeStoredGrant(previous);

    return this.getStatus(organizationId);
  }

  async getReport(
    organizationId: string,
    range: WebsiteAnalyticsReportRange,
  ): Promise<WebsiteAnalyticsReport> {
    const integration = await this.requireOAuthIntegration(organizationId);
    const propertyId = integration.propertyId;
    if (!propertyId) {
      throw new ConflictException({
        code: WEBSITE_ANALYTICS_ERROR_CODES.propertyNotSelected,
        message: 'Choose a Google Analytics property first',
      });
    }

    const cacheKey = `${organizationId}:${propertyId}:${range}`;
    const cached = this.reports.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.report;

    const reports = await this.withGoogle(integration, async () =>
      this.google.runReports(
        await this.accessToken(integration),
        propertyId,
        buildReportRequests(range),
      ),
    );
    const report = toWebsiteAnalyticsReport(range, reports, new Date());
    this.reports.set(cacheKey, { report, expiresAt: Date.now() + REPORT_CACHE_TTL_MS });

    return report;
  }

  private async requireOAuthIntegration(organizationId: string): Promise<StoredIntegration> {
    this.assertOAuthAvailable();
    const integration = await this.repository.findByOrganizationId(organizationId);
    if (!integration || integration.mode !== 'OAUTH' || !integration.encryptedRefreshToken) {
      throw this.notConnected();
    }
    if (integration.status === 'NEEDS_REAUTH') throw this.reauthRequired();

    return integration;
  }

  private async accessToken(integration: StoredIntegration): Promise<string> {
    const encryptedRefreshToken = integration.encryptedRefreshToken;
    if (!encryptedRefreshToken) throw this.notConnected();

    const cached = this.accessTokens.get(integration.organizationId);
    if (
      cached &&
      cached.encryptedRefreshToken === encryptedRefreshToken &&
      cached.expiresAt > Date.now()
    ) {
      return cached.token;
    }

    let refreshToken: string;
    try {
      refreshToken = decryptSecret(encryptedRefreshToken, this.encryptionKey());
    } catch {
      // A rotated key or a damaged value cannot be recovered; a fresh consent replaces it.
      throw new GoogleApiError('auth', 'Stored Google grant could not be decrypted');
    }

    const tokens = await this.google.refreshAccessToken(refreshToken);
    this.accessTokens.set(integration.organizationId, {
      encryptedRefreshToken,
      token: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000 - ACCESS_TOKEN_SAFETY_MS,
    });

    return tokens.access_token;
  }

  private async withGoogle<T>(integration: StoredIntegration, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof GoogleApiError)) throw error;

      this.logger.warn(`Google Analytics request failed (${error.kind}): ${error.message}`);
      if (error.kind === 'auth') {
        await this.repository.markNeedsReauth(integration);
        this.forgetOrganization(integration.organizationId);
        throw this.reauthRequired();
      }
      if (error.kind === 'forbidden') {
        throw new ConflictException({
          code: WEBSITE_ANALYTICS_ERROR_CODES.propertyForbidden,
          message:
            'The connected Google account cannot read this Google Analytics property. Choose another property.',
        });
      }
      if (error.kind === 'rate_limited') {
        throw new ServiceUnavailableException({
          code: WEBSITE_ANALYTICS_ERROR_CODES.upstreamFailed,
          message: 'Google Analytics is busy right now. Try again in a few minutes.',
        });
      }
      throw new BadGatewayException({
        code: WEBSITE_ANALYTICS_ERROR_CODES.upstreamFailed,
        message: 'Google Analytics did not respond. Try again later.',
      });
    }
  }

  private async revokeStoredGrant(integration: StoredIntegration | null): Promise<void> {
    if (!integration?.encryptedRefreshToken || !this.oauthAvailable) return;

    try {
      await this.google.revokeToken(
        decryptSecret(integration.encryptedRefreshToken, this.encryptionKey()),
      );
    } catch (error) {
      this.logger.warn(`Google Analytics grant was not revoked: ${describeError(error)}`);
    }
  }

  private forgetOrganization(organizationId: string): void {
    this.accessTokens.delete(organizationId);
    this.forgetReports(organizationId);
  }

  private forgetReports(organizationId: string): void {
    for (const key of this.reports.keys()) {
      if (key.startsWith(`${organizationId}:`)) this.reports.delete(key);
    }
  }

  private encryptionKey(): Buffer {
    return Buffer.from(this.config.getOrThrow<string>('INTEGRATION_ENCRYPTION_KEY'), 'base64');
  }

  private assertOAuthAvailable(): void {
    if (!this.oauthAvailable) {
      throw new ServiceUnavailableException({
        code: WEBSITE_ANALYTICS_ERROR_CODES.oauthUnavailable,
        message: 'Google sign-in for analytics is not configured on this server',
      });
    }
  }

  private notConnected() {
    return new NotFoundException({
      code: WEBSITE_ANALYTICS_ERROR_CODES.notConnected,
      message: 'Google Analytics is not connected',
    });
  }

  private reauthRequired() {
    return new ConflictException({
      code: WEBSITE_ANALYTICS_ERROR_CODES.reauthRequired,
      message: 'Google Analytics access was revoked. Reconnect your Google account.',
    });
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
