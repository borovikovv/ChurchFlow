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
        // A verified address is an identity. Once the account stops holding it, the
        // sign-in method built on it has to go with it.
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
