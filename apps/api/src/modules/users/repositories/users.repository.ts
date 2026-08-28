import { Injectable } from '@nestjs/common';
import { normalizeLoginEmail } from '../../../common/auth/email-identity';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    return this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  }

  async updateProfile(userId: string, input: UpdateCurrentUserProfileInput) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });
      const emailChanged =
        input.email !== undefined &&
        normalizeLoginEmail(input.email ?? '') !== normalizeLoginEmail(current.email ?? '');

      if (emailChanged) {
        // A verified address is an identity, so it cannot outlive being the account's
        // address. That also means it cannot be given up while it is the only way back in:
        // the new address is unconfirmed until its owner proves it, and by then the session
        // that could have proved it may be gone.
        const emailAccounts = await tx.authAccount.count({
          where: { userId, provider: 'email', deletedAt: null },
        });
        const otherAccounts = await tx.authAccount.count({
          where: { userId, provider: { not: 'email' }, deletedAt: null },
        });

        if (emailAccounts > 0 && otherAccounts === 0) {
          throw new Error('LAST_SIGN_IN_METHOD');
        }

        await tx.authAccount.deleteMany({ where: { userId, provider: 'email' } });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(emailChanged ? { emailVerified: null } : {}),
          ...(input.baptizedAt !== undefined
            ? {
                baptizedAt: input.baptizedAt ? new Date(`${input.baptizedAt}T00:00:00.000Z`) : null,
              }
            : {}),
          ...(input.baptismChurchName !== undefined
            ? { baptismChurchName: input.baptismChurchName }
            : {}),
          ...(input.locale !== undefined ? { locale: input.locale } : {}),
        },
      });
    });
  }
}
