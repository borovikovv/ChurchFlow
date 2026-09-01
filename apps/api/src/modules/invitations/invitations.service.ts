import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  Prisma,
  type AuthProvider,
  type InvitationTargetProvider,
  type OrganizationRole,
} from '@churchflow/db';
import { ENTITLEMENTS, type CreateOrganizationInvitationInput } from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { UserLocaleService } from '../../common/locale/user-locale.service';
import { EmailService } from '../email/email.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { InvitationsRepository } from './repositories/invitations.repository';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface InvitationForAcceptance {
  id: string;
  organizationId: string;
  email: string | null;
  mode: 'targeted_telegram' | 'claimable_link';
  targetProvider: InvitationTargetProvider | null;
  targetProviderAccountId: string | null;
  targetDisplay: string | null;
  role: OrganizationRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  organization: {
    id: string;
    name: string;
  };
}

type PendingInvitationForUser = InvitationForAcceptance;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly userLocaleService: UserLocaleService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  createRawInvitationToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hashToken(rawToken) };
  }

  async createForOrganization(
    organizationId: string,
    input: CreateOrganizationInvitationInput,
    actorUserId: string,
  ) {
    const organization = await this.invitationsRepository.findActiveOrganization(organizationId);
    if (!organization) {
      throw new NotFoundException('Active organization was not found');
    }

    const actorMembership = await this.invitationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!actorMembership || !this.canInviteRole(actorMembership.role, input.role)) {
      throw new ForbiddenException('You do not have permission to invite this role');
    }

    if (input.mode === 'targeted_telegram') {
      if (input.targetProvider !== 'telegram' || !input.targetProviderAccountId) {
        throw new BadRequestException('Targeted invitations require Telegram identity');
      }

      const existingMember = await this.invitationsRepository.findMemberByTarget(
        organizationId,
        input.targetProvider,
        input.targetProviderAccountId,
      );
      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    if (input.mode === 'claimable_link' && (input.role === 'OWNER' || input.role === 'ADMIN')) {
      throw new BadRequestException('Claimable links are allowed only for member and viewer roles');
    }

    const token = this.createRawInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitationInput = {
      organizationId,
      mode: input.mode,
      targetProvider: input.targetProvider,
      targetProviderAccountId: input.targetProviderAccountId,
      targetDisplay: input.targetDisplay,
      email: input.email,
      role: input.role,
      invitedByUserId: actorUserId,
      tokenHash: token.tokenHash,
      expiresAt,
    };
    let invitation: Awaited<ReturnType<InvitationsRepository['createOrRefreshPending']>>;
    try {
      invitation = await this.invitationsRepository.createOrRefreshPending(invitationInput);
    } catch (error: unknown) {
      if (
        input.mode !== 'targeted_telegram' ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      // A concurrent targeted invite won the partial-unique-index race. Refresh that row.
      invitation = await this.invitationsRepository.createOrRefreshPending(invitationInput);
    }

    const acceptUrl = this.emailService.buildOrganizationInvitationUrl(token.rawToken);

    const notificationEmail = input.email;
    const inviteeLocale = await this.userLocaleService.forRecipient(notificationEmail, actorUserId);
    const emailSent = notificationEmail
      ? await this.trySendEmail(() =>
          this.emailService.sendOrganizationInvitationEmail({
            locale: inviteeLocale,
            email: notificationEmail,
            organizationName: organization.name,
            role: input.role,
            token: token.rawToken,
            expiresAt,
          }),
        )
      : false;

    await this.auditService.record({
      organizationId,
      actorUserId,
      action: 'INVITE',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: {
        email: input.email,
        mode: input.mode,
        targetProvider: input.targetProvider,
        targetProviderAccountId: input.targetProviderAccountId,
        targetDisplay: input.targetDisplay,
        role: input.role,
        delivery: input.email ? 'email' : 'link',
      },
    });

    return {
      invitation,
      acceptUrl,
      emailSent,
    };
  }

  async validate(rawToken: string) {
    const invitation = await this.invitationsRepository.findByTokenHash(this.hashToken(rawToken));
    if (!invitation) {
      return { valid: false, reason: 'NOT_FOUND' };
    }

    const isExpired = invitation.expiresAt.getTime() <= Date.now();
    const isValid =
      invitation.acceptedAt === null &&
      invitation.revokedAt === null &&
      invitation.status === 'PENDING' &&
      !isExpired;

    return {
      valid: isValid,
      reason: isValid ? null : isExpired ? 'EXPIRED' : 'UNAVAILABLE',
      organizationId: invitation.organizationId,
      organizationName: invitation.organization.name,
      mode: invitation.mode,
      role: invitation.role,
      requiresSignup: true,
      delivery: invitation.email ? 'email' : 'link',
    };
  }

  async accept(rawToken: string, actorUserId: string) {
    const invitation = await this.invitationsRepository.findByTokenHash(this.hashToken(rawToken));
    if (!invitation) {
      throw new NotFoundException('Invitation was not found');
    }

    return this.acceptInvitation(invitation, actorUserId);
  }

  async listPendingForAuthenticatedUser(actorUserId: string) {
    const invitations: PendingInvitationForUser[] =
      await this.invitationsRepository.listPendingForUserTelegramAccounts(actorUserId);

    return invitations.map((invitation) => {
      const isExpired = invitation.expiresAt.getTime() <= Date.now();

      return {
        id: invitation.id,
        valid: !isExpired,
        reason: isExpired ? 'EXPIRED' : null,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        mode: invitation.mode,
        targetProvider: invitation.targetProvider,
        targetDisplay: invitation.targetDisplay,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      };
    });
  }

  async acceptPending(invitationId: string, actorUserId: string) {
    const invitation = await this.invitationsRepository.findPendingById(invitationId);
    if (!invitation) {
      throw new NotFoundException('Pending invitation was not found');
    }

    return this.acceptInvitation(invitation, actorUserId);
  }

  private async acceptInvitation(invitation: InvitationForAcceptance, actorUserId: string) {
    // Accepting an invitation creates a member, so it is a members.write action. Neither
    // accept route carries an :organizationId, so the entitlement guard cannot see them;
    // the organization is only known once the invitation is loaded.
    await this.entitlementsService.assert(invitation.organizationId, ENTITLEMENTS.membersWrite);

    if (
      invitation.acceptedAt !== null ||
      invitation.revokedAt !== null ||
      invitation.status !== 'PENDING'
    ) {
      throw new ConflictException('Invitation is no longer pending');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Invitation has expired');
    }

    const user = await this.invitationsRepository.findUserForInvitation(actorUserId);
    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    const identity = this.acceptingIdentity(user);
    if (!identity) {
      throw new ForbiddenException(
        'A Telegram account or a verified email address is required to accept an invitation',
      );
    }

    if (invitation.mode === 'targeted_telegram') {
      if (
        invitation.targetProvider !== 'telegram' ||
        identity.provider !== 'telegram' ||
        invitation.targetProviderAccountId !== identity.accountId
      ) {
        throw new ForbiddenException('Authenticated provider account must match invitation target');
      }
    }

    if (
      invitation.mode === 'claimable_link' &&
      (invitation.role === 'OWNER' || invitation.role === 'ADMIN')
    ) {
      throw new BadRequestException('Claimable links are not allowed for elevated roles');
    }

    if (
      invitation.mode === 'claimable_link' &&
      invitation.targetProviderAccountId &&
      (invitation.targetProvider !== identity.provider ||
        invitation.targetProviderAccountId !== identity.accountId)
    ) {
      throw new ForbiddenException('Invitation was already claimed by another account');
    }

    const existingMembership = await this.invitationsRepository.findActiveMembership(
      invitation.organizationId,
      actorUserId,
    );
    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    let result: { organizationId: string };
    try {
      result = await this.invitationsRepository.accept({
        invitationId: invitation.id,
        userId: actorUserId,
        organizationId: invitation.organizationId,
        role: invitation.role,
        acceptedProviderAccountId: identity.accountId,
        ...(invitation.mode === 'claimable_link'
          ? {
              claim: {
                targetProvider: identity.provider,
                targetProviderAccountId: identity.accountId,
              },
            }
          : {}),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVITATION_NOT_PENDING') {
        throw new ConflictException('Invitation is no longer pending');
      }

      throw error;
    }

    return {
      organizationId: result.organizationId,
      redirectTo: `/dashboard/${result.organizationId}`,
    };
  }

  // A claimable link is a bearer credential, so the provider behind the session does not
  // matter; a targeted invitation still has to match the identity it names. An address only
  // counts once its owner has proved they hold it.
  private acceptingIdentity(user: {
    emailVerified: Date | null;
    accounts: ReadonlyArray<{ provider: AuthProvider; providerAccountId: string }>;
  }): { provider: InvitationTargetProvider; accountId: string } | null {
    const telegram = user.accounts.find((account) => account.provider === 'telegram');
    if (telegram) {
      return { provider: 'telegram', accountId: telegram.providerAccountId };
    }

    const email = user.accounts.find((account) => account.provider === 'email');
    if (email && user.emailVerified !== null) {
      return { provider: 'email', accountId: email.providerAccountId };
    }

    return null;
  }

  async revoke(organizationId: string, invitationId: string, actorUserId: string) {
    await this.assertCanManageInvitations(organizationId, actorUserId);
    const invitation = await this.invitationsRepository.revoke(organizationId, invitationId);
    if (!invitation) {
      throw new NotFoundException('Pending invitation was not found');
    }

    await this.auditService.record({
      organizationId,
      actorUserId,
      action: 'REVOKE',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: {
        email: invitation.email,
        targetProvider: invitation.targetProvider,
        targetProviderAccountId: invitation.targetProviderAccountId,
        role: invitation.role,
      },
    });

    return invitation;
  }

  async resend(organizationId: string, invitationId: string, actorUserId: string) {
    await this.assertCanManageInvitations(organizationId, actorUserId);
    const current = await this.invitationsRepository.findManageableById(
      organizationId,
      invitationId,
    );
    if (!current) {
      throw new NotFoundException('Pending invitation was not found');
    }
    if (!current.email) {
      throw new ConflictException('Link invitations do not have an email recipient');
    }
    const notificationEmail = current.email;

    const token = this.createRawInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.invitationsRepository.resend(
      organizationId,
      invitationId,
      token.tokenHash,
      expiresAt,
    );
    if (!invitation) {
      throw new NotFoundException('Pending invitation was not found');
    }

    const inviteeLocale = await this.userLocaleService.forRecipient(notificationEmail, actorUserId);
    const emailSent = await this.trySendEmail(() =>
      this.emailService.sendOrganizationInvitationEmail({
        locale: inviteeLocale,
        email: notificationEmail,
        organizationName: invitation.organization.name,
        role: invitation.role,
        token: token.rawToken,
        expiresAt,
      }),
    );

    await this.auditService.record({
      organizationId,
      actorUserId,
      action: 'RESEND',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: {
        email: invitation.email,
        targetProvider: invitation.targetProvider,
        targetProviderAccountId: invitation.targetProviderAccountId,
        role: invitation.role,
      },
    });

    return {
      invitation,
      acceptUrl: this.emailService.buildOrganizationInvitationUrl(token.rawToken),
      emailSent,
    };
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async trySendEmail(send: () => Promise<void>): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error: unknown) {
      this.logger.error(
        'Invitation email delivery failed after the invitation was persisted',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private canInviteRole(actorRole: OrganizationRole, invitedRole: OrganizationRole): boolean {
    if (actorRole === 'OWNER') {
      return true;
    }

    if (actorRole === 'ADMIN') {
      return invitedRole === 'MEMBER' || invitedRole === 'VIEWER';
    }

    return false;
  }

  private async assertCanManageInvitations(
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    const membership = await this.invitationsRepository.findActiveMembership(
      organizationId,
      actorUserId,
    );
    if (!membership || !this.canInviteRole(membership.role, 'MEMBER')) {
      throw new ForbiddenException('You do not have permission to manage invitations');
    }
  }
}
