import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { OrganizationRole } from '@churchflow/db';
import type { CreateOrganizationInvitationInput } from '@churchflow/shared';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { InvitationsRepository } from './repositories/invitations.repository';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

    if (input.email) {
      const existingMember = await this.invitationsRepository.findMemberByEmail(
        organizationId,
        input.email,
      );
      if (existingMember) {
        throw new ConflictException('User is already a member of this organization');
      }
    }

    const token = this.createRawInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.invitationsRepository.createOrRefreshPending({
      organizationId,
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
    if (invitation.email) {
      if (!user?.email) {
        throw new UnauthorizedException('Authenticated user email is required');
      }

      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw new ForbiddenException('Authenticated user email must match invitation email');
      }

      if (user.emailVerified === null) {
        throw new ForbiddenException('Email must be verified before accepting an invitation');
      }
    }

    const existingMembership = await this.invitationsRepository.findActiveMembership(
      invitation.organizationId,
      actorUserId,
    );
    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    const result = await this.invitationsRepository.accept(
      invitation.id,
      actorUserId,
      invitation.organizationId,
      invitation.role,
    );

    await this.auditService.record({
      organizationId: invitation.organizationId,
      actorUserId,
      action: 'ACCEPT',
      entityType: 'OrganizationInvitation',
      entityId: invitation.id,
      metadata: { role: invitation.role, email: invitation.email },
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
      metadata: { email: invitation.email, role: invitation.role },
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
      metadata: { email: invitation.email, role: invitation.role },
    });

    return invitation;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
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
