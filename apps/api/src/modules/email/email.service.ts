import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_APP_LOCALE, type AppLocale } from '@churchflow/shared';
import { emailMessages, formatEmailDateTime } from './email-messages';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider';

export interface OrganizationRequestAdminEmailInput {
  locale?: AppLocale;
  requestId: string;
  organizationName: string;
  contactName: string;
  contactEmail?: string | null;
  contactTelegramId: string;
  contactTelegramUsername?: string | null;
  contactPhone?: string | null;
  message?: string | null;
}

export interface OrganizationInvitationEmailInput {
  locale?: AppLocale;
  email: string;
  organizationName: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export interface OrganizationRequestRejectedEmailInput {
  locale?: AppLocale;
  email: string;
  organizationName: string;
  rejectionReason: string;
}

export interface OrganizationRequestApprovedEmailInput {
  locale?: AppLocale;
  email: string;
  organizationName: string;
  organizationId: string;
}

export interface MembershipClaimEmailInput {
  locale?: AppLocale;
  email: string;
  organizationName: string;
  token: string;
  expiresAt: Date;
}

export interface NotificationEmailInput {
  locale?: AppLocale;
  email: string;
  organizationName: string;
  title: string;
  body?: string | null;
  url?: string | null;
  notificationId?: string | null;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  buildOrganizationInvitationUrl(token: string): string {
    return `${this.webAppUrl}/invitations/accept?token=${encodeURIComponent(token)}`;
  }

  buildMembershipClaimUrl(token: string): string {
    return `${this.webAppUrl}/member-claims/accept?token=${encodeURIComponent(token)}`;
  }

  async sendMembershipClaimEmail(input: MembershipClaimEmailInput): Promise<void> {
    const locale = input.locale ?? DEFAULT_APP_LOCALE;
    const messages = emailMessages(locale).membershipClaim;
    await this.emailProvider.send({
      to: input.email,
      subject: messages.subject({ organizationName: input.organizationName }),
      text: [
        messages.intro({ organizationName: input.organizationName }),
        messages.requestAccess({ url: this.buildMembershipClaimUrl(input.token) }),
        messages.expiresAt({ expiresAt: formatEmailDateTime(input.expiresAt, locale) }),
      ].join('\n'),
    });
  }

  async sendOrganizationRequestAdminEmail(
    input: OrganizationRequestAdminEmailInput,
  ): Promise<void> {
    const adminReviewUrl = `${this.webAppUrl}/admin/organization-requests/${input.requestId}`;
    const messages = emailMessages(input.locale ?? DEFAULT_APP_LOCALE).organizationRequestAdmin;
    const { labels } = messages;
    await this.emailProvider.send({
      to: this.platformAdminEmail,
      subject: messages.subject({ organizationName: input.organizationName }),
      text: [
        `${labels.organization}: ${input.organizationName}`,
        `${labels.contact}: ${input.contactName}${input.contactEmail ? ` <${input.contactEmail}>` : ''}`,
        `${labels.telegramId}: ${input.contactTelegramId}`,
        ...(input.contactTelegramUsername
          ? [`${labels.telegramUsername}: ${input.contactTelegramUsername}`]
          : []),
        input.contactPhone ? `${labels.phone}: ${input.contactPhone}` : null,
        input.message ? `${labels.message}: ${input.message}` : null,
        `${labels.review}: ${adminReviewUrl}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  async sendOrganizationInvitationEmail(input: OrganizationInvitationEmailInput): Promise<void> {
    const acceptUrl = this.buildOrganizationInvitationUrl(input.token);
    const locale = input.locale ?? DEFAULT_APP_LOCALE;
    const messages = emailMessages(locale).organizationInvitation;
    await this.emailProvider.send({
      to: input.email,
      subject: messages.subject({ organizationName: input.organizationName }),
      text: [
        messages.intro({ organizationName: input.organizationName, role: input.role }),
        messages.accept({ url: acceptUrl }),
        messages.expiresAt({ expiresAt: formatEmailDateTime(input.expiresAt, locale) }),
      ].join('\n'),
    });
  }

  async sendOrganizationRequestRejectedEmail(
    input: OrganizationRequestRejectedEmailInput,
  ): Promise<void> {
    const messages = emailMessages(input.locale ?? DEFAULT_APP_LOCALE).organizationRequestRejected;
    await this.emailProvider.send({
      to: input.email,
      subject: messages.subject({ organizationName: input.organizationName }),
      text: [
        messages.rejected({ organizationName: input.organizationName }),
        messages.reason({ rejectionReason: input.rejectionReason }),
      ].join('\n'),
    });
  }

  async sendOrganizationRequestApprovedEmail(
    input: OrganizationRequestApprovedEmailInput,
  ): Promise<void> {
    const dashboardUrl = `${this.webAppUrl}/dashboard/${input.organizationId}`;
    const messages = emailMessages(input.locale ?? DEFAULT_APP_LOCALE).organizationRequestApproved;
    await this.emailProvider.send({
      to: input.email,
      subject: messages.subject({ organizationName: input.organizationName }),
      text: [
        messages.approved({ organizationName: input.organizationName }),
        messages.owner,
        messages.openDashboard({ url: dashboardUrl }),
      ].join('\n'),
    });
  }

  async sendNotificationEmail(input: NotificationEmailInput): Promise<void> {
    const url = input.url
      ? new URL(notificationDetailUrl(input.url, input.notificationId), this.webAppUrl).toString()
      : null;
    const messages = emailMessages(input.locale ?? DEFAULT_APP_LOCALE).notification;
    await this.emailProvider.send({
      to: input.email,
      subject: messages.subject({ organizationName: input.organizationName, title: input.title }),
      text: [input.title, input.body, url ? messages.open({ url }) : null]
        .filter(Boolean)
        .join('\n'),
      suppressFailureLog: true,
    });
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }

  get platformAdminEmail(): string {
    return this.config.getOrThrow<string>('PLATFORM_ADMIN_EMAIL');
  }
}

function notificationDetailUrl(url: string, notificationId: string | null | undefined): string {
  if (!notificationId) return url;
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}notificationId=${encodeURIComponent(notificationId)}`;
}
