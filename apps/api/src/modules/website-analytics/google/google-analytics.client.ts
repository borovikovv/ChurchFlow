import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GA_ADMIN_URL = 'https://analyticsadmin.googleapis.com/v1beta';
const GA_DATA_URL = 'https://analyticsdata.googleapis.com/v1beta';
const GOOGLE_TIMEOUT_MS = 10_000;
const GA_PAGE_SIZE = 200;
// Nobody manages hundreds of GA accounts for one church; the cap keeps a runaway pagination loop
// from hanging the request.
const GA_MAX_PAGES = 5;

/**
 * `auth` means Google no longer accepts the stored grant: the owner has to reconnect. `forbidden`
 * means the grant is fine but cannot read this property, which a new consent would not change.
 * `rate_limited` and `failed` are worth retrying.
 */
export type GoogleApiErrorKind = 'auth' | 'forbidden' | 'rate_limited' | 'failed';

export class GoogleApiError extends Error {
  constructor(
    readonly kind: GoogleApiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
});

const tokenErrorSchema = z.object({ error: z.string() });

const accountSummariesSchema = z.object({
  accountSummaries: z
    .array(
      z.object({
        account: z.string(),
        displayName: z.string().default(''),
        propertySummaries: z
          .array(
            z.object({
              property: z.string(),
              displayName: z.string().default(''),
              propertyType: z.string().optional(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const dataStreamsSchema = z.object({
  dataStreams: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        displayName: z.string().default(''),
        webStreamData: z
          .object({ measurementId: z.string(), defaultUri: z.string().optional() })
          .optional(),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const reportRowSchema = z.object({
  dimensionValues: z.array(z.object({ value: z.string().default('') })).default([]),
  metricValues: z.array(z.object({ value: z.string().default('0') })).default([]),
});

const batchReportsSchema = z.object({
  reports: z
    .array(
      z.object({
        rows: z.array(reportRowSchema).default([]),
        metadata: z.object({ timeZone: z.string().optional() }).default({}),
      }),
    )
    .default([]),
});

export type GoogleTokenResponse = z.infer<typeof tokenResponseSchema>;
export type GoogleAccountSummary = z.infer<
  typeof accountSummariesSchema
>['accountSummaries'][number];
export type GoogleWebDataStream = {
  id: string;
  displayName: string;
  measurementId: string;
  defaultUri: string | null;
};
export type GoogleReport = z.infer<typeof batchReportsSchema>['reports'][number];

@Injectable()
export class GoogleAnalyticsClient {
  private readonly logger = new Logger(GoogleAnalyticsClient.name);

  constructor(private readonly config: ConfigService) {}

  exchangeCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleTokenResponse> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    });
  }

  refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    return this.requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  /** Best effort: a token Google already dropped is as good as revoked. */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }).toString(),
        signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
      });
      if (!response.ok && response.status !== 400) {
        this.logger.warn(`Google token revocation failed with status ${String(response.status)}`);
      }
    } catch (error) {
      this.logger.warn(`Google token revocation failed: ${describeError(error)}`);
    }
  }

  async listAccountSummaries(accessToken: string): Promise<GoogleAccountSummary[]> {
    const accounts: GoogleAccountSummary[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < GA_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ pageSize: String(GA_PAGE_SIZE) });
      if (pageToken) query.set('pageToken', pageToken);

      const payload = parseResponse(
        accountSummariesSchema,
        await this.requestJson(`${GA_ADMIN_URL}/accountSummaries?${query.toString()}`, {
          accessToken,
        }),
      );
      accounts.push(...payload.accountSummaries);
      pageToken = payload.nextPageToken;
      if (!pageToken) break;
    }

    return accounts;
  }

  async listWebDataStreams(
    accessToken: string,
    propertyId: string,
  ): Promise<GoogleWebDataStream[]> {
    const query = new URLSearchParams({ pageSize: String(GA_PAGE_SIZE) });
    const payload = parseResponse(
      dataStreamsSchema,
      await this.requestJson(
        `${GA_ADMIN_URL}/properties/${encodeURIComponent(propertyId)}/dataStreams?${query.toString()}`,
        { accessToken },
      ),
    );

    return payload.dataStreams.flatMap((stream) =>
      stream.type === 'WEB_DATA_STREAM' && stream.webStreamData
        ? [
            {
              id: lastResourceSegment(stream.name),
              displayName: stream.displayName,
              measurementId: stream.webStreamData.measurementId,
              defaultUri: stream.webStreamData.defaultUri ?? null,
            },
          ]
        : [],
    );
  }

  async runReports(
    accessToken: string,
    propertyId: string,
    requests: readonly object[],
  ): Promise<GoogleReport[]> {
    const payload = parseResponse(
      batchReportsSchema,
      await this.requestJson(
        `${GA_DATA_URL}/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
        { accessToken, body: { requests } },
      ),
    );

    return payload.reports;
  }

  private async requestToken(params: Record<string, string>): Promise<GoogleTokenResponse> {
    const response = await this.send(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
      }).toString(),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = tokenErrorSchema.safeParse(payload);
      // invalid_grant: the refresh token was revoked, expired or the code was already used.
      if (error.success && error.data.error === 'invalid_grant') {
        throw new GoogleApiError('auth', 'Google rejected the stored grant');
      }
      throw new GoogleApiError(
        'failed',
        `Google token request failed with status ${String(response.status)}`,
      );
    }

    const parsed = tokenResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new GoogleApiError('failed', 'Google token response was malformed');
    }

    return parsed.data;
  }

  private async requestJson(
    url: string,
    input: { accessToken: string; body?: object },
  ): Promise<unknown> {
    const response = await this.send(url, {
      method: input.body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        ...(input.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    });

    if (response.status === 401) {
      throw new GoogleApiError('auth', 'Google Analytics refused the access token');
    }
    if (response.status === 403) {
      throw new GoogleApiError('forbidden', 'Google Analytics denied access to the resource');
    }
    if (response.status === 429) {
      throw new GoogleApiError('rate_limited', 'Google Analytics quota exhausted');
    }
    if (!response.ok) {
      throw new GoogleApiError(
        'failed',
        `Google Analytics request failed with status ${String(response.status)}`,
      );
    }

    return response.json();
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS) });
    } catch (error) {
      throw new GoogleApiError('failed', `Google request failed: ${describeError(error)}`);
    }
  }
}

function parseResponse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new GoogleApiError('failed', 'Google Analytics response was malformed');
  }

  return parsed.data;
}

/** `accounts/123` -> `123`, `properties/1/dataStreams/2` -> `2`. */
export function lastResourceSegment(name: string): string {
  return name.slice(name.lastIndexOf('/') + 1);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}
