import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findManageableMember(organizationId: string, membershipId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: { not: 'REMOVED' },
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
        AND: {
          organization: {
            members: {
              some: {
                userId: actorUserId,
                role: { in: ['OWNER', 'ADMIN'] },
                status: 'ACTIVE',
                removedAt: null,
              },
            },
          },
        },
      },
    });
  }
  createPendingAsset(data: {
    organizationId: string;
    bucket: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    byteSize: number;
    membershipId: string;
  }) {
    const { membershipId, ...asset } = data;
    return this.prisma.mediaAsset.create({
      data: {
        ...asset,
        byteSize: BigInt(data.byteSize),
        metadata: { status: 'pending', membershipId },
      },
    });
  }
  findAsset(assetId: string, organizationId: string) {
    return this.prisma.mediaAsset.findFirst({
      where: { id: assetId, organizationId, deletedAt: null },
    });
  }
  async attachPhoto(
    organizationId: string,
    membershipId: string,
    assetId: string,
    actorUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.organizationMemberProfile.findFirst({
        where: { membershipId, membership: { organizationId } },
        select: { id: true, profilePhotoAssetId: true },
      });
      if (!profile) throw new Error('MEMBERSHIP_NOT_FOUND');
      await tx.organizationMemberProfile.update({
        where: { id: profile.id },
        data: { profilePhotoAssetId: assetId },
      });
      await tx.mediaAsset.update({
        where: { id: assetId },
        data: { metadata: { status: 'confirmed', membershipId } },
      });
      if (profile.profilePhotoAssetId && profile.profilePhotoAssetId !== assetId)
        await tx.mediaAsset.update({
          where: { id: profile.profilePhotoAssetId },
          data: { deletedAt: new Date() },
        });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE_MEMBER_PHOTO',
          entityType: 'OrganizationMember',
          entityId: membershipId,
          metadata: { assetId },
        },
      });
      return { assetId };
    });
  }
}
