import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@churchflow/db';
import { EmailService } from '../email/email.service';
import { MembershipClaimsRepository } from './repositories/membership-claims.repository';

const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class MembershipClaimsService {
  private readonly logger = new Logger(MembershipClaimsService.name);

  constructor(
    private readonly repository: MembershipClaimsRepository,
    private readonly emailService: EmailService,
  ) {}

  async validate(rawToken: string) {
    const claim = await this.repository.findByTokenHash(this.hash(rawToken));
    const valid =
      claim?.status === 'PENDING' &&
      claim.expiresAt.getTime() > Date.now() &&
      claim.membership.userId === null &&
      claim.membership.status === 'ACTIVE' &&
      claim.membership.removedAt === null &&
      claim.membership.organization.status === 'ACTIVE' &&
      claim.membership.organization.deletedAt === null;

    return valid
      ? {
          valid: true,
          organizationName: claim.membership.organization.name,
          expiresAt: claim.expiresAt,
          requiresAuthentication: true,
        }
      : { valid: false };
  }

  async generate(organizationId: string, membershipId: string, actorUserId: string) {
    return this.createOrRefresh(organizationId, membershipId, actorUserId);
  }

  async refresh(organizationId: string, claimId: string, actorUserId: string) {
    const claim = await this.repository.findManageableById(organizationId, claimId);
    if (!claim) throw new NotFoundException('Membership claim was not found');
    return this.createOrRefresh(organizationId, claim.membershipId, actorUserId);
  }

  private async createOrRefresh(organizationId: string, membershipId: string, actorUserId: string) {
    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);
    let result;
    try {
      result = await this.repository.createOrRefresh({
        organizationId,
        membershipId,
        actorUserId,
        tokenHash: this.hash(rawToken),
        expiresAt,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_CLAIMS') {
        throw new ForbiddenException('Only organization owners and admins can manage access');
      }
      if (error instanceof Error && error.message === 'MEMBERSHIP_NOT_CLAIMABLE') {
        throw new ConflictException('This member cannot be connected to an account');
      }
      if (error instanceof Error && error.message === 'CLAIM_ALREADY_REQUESTED') {
        throw new ConflictException('This access request is already awaiting review');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An active membership claim already exists');
      }
      throw error;
    }

    const claimUrl = this.emailService.buildMembershipClaimUrl(rawToken);
    const email = result.profile?.email;
    const emailSent = email
      ? await this.trySendEmail(() =>
          this.emailService.sendMembershipClaimEmail({
            email,
            organizationName: result.organizationName,
            token: rawToken,
            expiresAt,
          }),
        )
      : false;

    return {
      claim: { id: result.claim.id, status: result.claim.status },
      claimUrl,
      expiresAt,
      emailSent,
    };
  }

  async request(rawToken: string, actorUserId: string) {
    try {
      const result = await this.repository.request(this.hash(rawToken), actorUserId);
      if (result.expired) throw new GoneException('Membership claim has expired');
      return result;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'CLAIM_NOT_FOUND') {
        throw new NotFoundException('Membership claim was not found');
      }
      if (error instanceof Error && error.message === 'CLAIM_EXPIRED') {
        throw new GoneException('Membership claim has expired');
      }
      if (
        error instanceof Error &&
        ['CLAIM_NOT_PENDING', 'MEMBERSHIP_NOT_CLAIMABLE'].includes(error.message)
      ) {
        throw new ConflictException('Membership claim is no longer available');
      }
      if (error instanceof Error && error.message === 'TELEGRAM_ACCOUNT_REQUIRED') {
        throw new UnauthorizedException('An active Telegram account is required');
      }
      throw error;
    }
  }

  async status(actorUserId: string) {
    const claims = await this.repository.listForUser(actorUserId);
    return claims.map((claim) => ({
      ...claim,
      status:
        claim.status === 'PENDING' && claim.expiresAt.getTime() <= Date.now()
          ? ('EXPIRED' as const)
          : claim.status,
    }));
  }

  async approve(organizationId: string, claimId: string, actorUserId: string) {
    try {
      const result = await this.repository.approve(organizationId, claimId, actorUserId);
      if (result.expired) throw new GoneException('Membership claim has expired');
      if (result.conflict) {
        throw new ConflictException({
          code: 'MEMBERSHIP_ALREADY_EXISTS',
          message: 'This Telegram account is already a member of the organization',
        });
      }
      return { ...result, redirectTo: `/dashboard/${organizationId}` };
    } catch (error: unknown) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_CLAIMS') {
        throw new ForbiddenException('Only organization owners and admins can approve access');
      }
      if (error instanceof Error && error.message === 'CLAIM_NOT_REQUESTED') {
        throw new ConflictException('Membership claim is not awaiting approval');
      }
      if (
        error instanceof Error &&
        ['MEMBERSHIP_NOT_CLAIMABLE', 'CLAIMANT_INACTIVE'].includes(error.message)
      ) {
        throw new ConflictException('Membership or claimant is no longer active');
      }
      throw error;
    }
  }

  reject(organizationId: string, claimId: string, actorUserId: string) {
    return this.changeStatus(organizationId, claimId, actorUserId, 'REJECTED');
  }

  revoke(organizationId: string, claimId: string, actorUserId: string) {
    return this.changeStatus(organizationId, claimId, actorUserId, 'REVOKED');
  }

  private async changeStatus(
    organizationId: string,
    claimId: string,
    actorUserId: string,
    action: 'REJECTED' | 'REVOKED',
  ) {
    try {
      const result = await this.repository.changeStatus({
        organizationId,
        claimId,
        actorUserId,
        action,
      });
      if (!result) throw new NotFoundException('Active membership claim was not found');
      return result;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Error && error.message === 'ACTOR_CANNOT_MANAGE_CLAIMS') {
        throw new ForbiddenException('Only organization owners and admins can manage access');
      }
      throw error;
    }
  }

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private async trySendEmail(send: () => Promise<void>): Promise<boolean> {
    try {
      await send();
      return true;
    } catch (error: unknown) {
      this.logger.error(
        'Membership claim email failed after the claim was committed',
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }
}
