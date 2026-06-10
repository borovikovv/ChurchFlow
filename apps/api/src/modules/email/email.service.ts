import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OrganizationRequestAdminEmailInput {
  requestId: string;
  organizationName: string;
  contactName: string;
  contactEmail: string;
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOrganizationRequestAdminEmail(input: OrganizationRequestAdminEmailInput): Promise<void> {
    const adminReviewUrl = `${this.webAppUrl}/admin/organization-requests/${input.requestId}`;
    this.logEmail('New organization request', input.contactEmail, {
      subject: `New organization request: ${input.organizationName}`,
      organizationName: input.organizationName,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      message: input.message,
      adminReviewUrl
    });
  }

  async sendOrganizationInvitationEmail(input: OrganizationInvitationEmailInput): Promise<void> {
    const acceptUrl = `${this.webAppUrl}/invitations/accept?token=${encodeURIComponent(input.token)}`;
    this.logEmail('Organization invitation', input.email, {
      subject: `You are invited to join ${input.organizationName}`,
      organizationName: input.organizationName,
      role: input.role,
      acceptUrl,
      expiresAt: input.expiresAt.toISOString()
    });
  }

  async sendOrganizationRequestRejectedEmail(input: OrganizationRequestRejectedEmailInput): Promise<void> {
    this.logEmail('Organization request rejected', input.email, {
      subject: `Organization request update: ${input.organizationName}`,
      organizationName: input.organizationName,
      rejectionReason: input.rejectionReason
    });
  }

  private get webAppUrl(): string {
    return this.config.getOrThrow<string>('WEB_APP_URL');
  }

  private logEmail(event: string, recipient: string, payload: Record<string, unknown>): void {
    // TODO: Swap this local provider with Resend/Postmark/SMTP while preserving this service contract.
    this.logger.log({ event, recipient, payload });
  }
}
