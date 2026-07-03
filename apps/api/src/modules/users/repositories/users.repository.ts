import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string) {
    return this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  }

  async updateProfile(userId: string, input: UpdateCurrentUserProfileInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.baptizedAt !== undefined
          ? { baptizedAt: input.baptizedAt ? new Date(`${input.baptizedAt}T00:00:00.000Z`) : null }
          : {}),
        ...(input.baptismChurchName !== undefined
          ? { baptismChurchName: input.baptismChurchName }
          : {}),
      },
    });
  }
}
