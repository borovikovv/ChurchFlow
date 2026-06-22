import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { InvitationTargetProvider, OrganizationRole } from '@churchflow/db';
import type { CreateOrganizationInvitationInput } from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
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
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
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
    const invitation = await this.invitationsRepository.createOrRefreshPending({
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
    });

    const acceptUrl = this.emailService.buildOrganizationInvitationUrl(token.rawToken);

    if (input.email) {
      await this.emailService.sendOrganizationInvitationEmail({
        email: input.email,
        organizationName: organization.name,
        role: input.role,
        token: token.rawToken,
        expiresAt,
      });
    }

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
      emailSent: Boolean(input.email),
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
      email: invitation.email,
      mode: invitation.mode,
      targetProvider: invitation.targetProvider,
      targetProviderAccountId: invitation.targetProviderAccountId,
      targetDisplay: invitation.targetDisplay,
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

    const telegramAccount = user.accounts[0];
    if (!telegramAccount) {
      throw new ForbiddenException('Authenticated Telegram account is required');
    }

    if (invitation.mode === 'targeted_telegram') {
      if (
        invitation.targetProvider !== 'telegram' ||
        invitation.targetProviderAccountId !== telegramAccount.providerAccountId
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
      invitation.targetProviderAccountId !== telegramAccount.providerAccountId
    ) {
      throw new ForbiddenException('Invitation was already claimed by another Telegram account');
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
        ...(invitation.mode === 'claimable_link'
          ? {
              claim: {
                targetProvider: 'telegram',
                targetProviderAccountId: telegramAccount.providerAccountId,
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

    const acceptedTargetProviderAccountId: string =
      invitation.mode === 'claimable_link'
        ? telegramAccount.providerAccountId
        : this.requireTargetProviderAccountId(invitation.targetProviderAccountId);

    await this.auditService.record({
      organizationId: invitation.organizationId,
      actorUserId,
      action: 'ACCEPT',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: {
        role: invitation.role,
        email: invitation.email,
        mode: invitation.mode,
        targetProvider: invitation.targetProvider,
        targetProviderAccountId: acceptedTargetProviderAccountId,
      },
    });

    return {
      organizationId: result.organizationId,
      redirectTo: `/dashboard/${result.organizationId}`,
    };
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

    if (!invitation.email) {
      throw new ConflictException('Link invitations do not have an email recipient');
    }

    await this.emailService.sendOrganizationInvitationEmail({
      email: invitation.email,
      organizationName: invitation.organization.name,
      role: invitation.role,
      token: token.rawToken,
      expiresAt,
    });

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

    return invitation;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private requireTargetProviderAccountId(value: string | null): string {
    if (!value) {
      throw new ForbiddenException('Invitation target provider account is missing');
    }

    return value;
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
