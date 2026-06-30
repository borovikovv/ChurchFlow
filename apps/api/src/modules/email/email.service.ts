import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, type EmailProvider } from './email.provider';

export interface OrganizationRequestAdminEmailInput {
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
  email: string;
  organizationName: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export interface OrganizationRequestRejectedEmailInput {
  email: string;
  organizationName: string;
  rejectionReason: string;
}

export interface OrganizationRequestApprovedEmailInput {
  email: string;
  organizationName: string;
  organizationId: string;
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

  async sendOrganizationRequestAdminEmail(
    input: OrganizationRequestAdminEmailInput,
  ): Promise<void> {
    const adminReviewUrl = `${this.webAppUrl}/admin/organization-requests/${input.requestId}`;
    await this.emailProvider.send({
      to: this.platformAdminEmail,
      subject: `New organization request: ${input.organizationName}`,
      text: [
        `Organization: ${input.organizationName}`,
        `Contact: ${input.contactName}${input.contactEmail ? ` <${input.contactEmail}>` : ''}`,
        `Telegram ID: ${input.contactTelegramId}`,
        ...(input.contactTelegramUsername
          ? [`Telegram username: ${input.contactTelegramUsername}`]
          : []),
        input.contactPhone ? `Phone: ${input.contactPhone}` : null,
        input.message ? `Message: ${input.message}` : null,
        `Review: ${adminReviewUrl}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  async sendOrganizationInvitationEmail(input: OrganizationInvitationEmailInput): Promise<void> {
    const acceptUrl = this.buildOrganizationInvitationUrl(input.token);
    await this.emailProvider.send({
      to: input.email,
      subject: `You are invited to join ${input.organizationName}`,
      text: [
        `You are invited to join ${input.organizationName} as ${input.role}.`,
        `Accept invitation: ${acceptUrl}`,
        `This invitation expires at ${input.expiresAt.toISOString()}.`,
      ].join('\n'),
    });
  }

  async sendOrganizationRequestRejectedEmail(
    input: OrganizationRequestRejectedEmailInput,
  ): Promise<void> {
    await this.emailProvider.send({
      to: input.email,
      subject: `Organization request update: ${input.organizationName}`,
      text: [
        `Your organization request for ${input.organizationName} was rejected.`,
        `Reason: ${input.rejectionReason}`,
      ].join('\n'),
    });
  }

  async sendOrganizationRequestApprovedEmail(
    input: OrganizationRequestApprovedEmailInput,
  ): Promise<void> {
    const dashboardUrl = `${this.webAppUrl}/dashboard/${input.organizationId}`;
    await this.emailProvider.send({
      to: input.email,
      subject: `Your ChurchFlow organization is ready: ${input.organizationName}`,
      text: [
        `Your organization ${input.organizationName} has been approved.`,
        'You are its owner.',
        `Open dashboard: ${dashboardUrl}`,
      ].join('\n'),
    });
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }

  private get platformAdminEmail(): string {
    return this.config.getOrThrow<string>('PLATFORM_ADMIN_EMAIL');
  }
}
