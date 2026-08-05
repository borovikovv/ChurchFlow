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

  findPhotoUpdatableMember(organizationId: string, membershipId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        id: membershipId,
        organizationId,
        status: { not: 'REMOVED' },
        removedAt: null,
        organization: {
          status: 'ACTIVE',
          deletedAt: null,
          members: {
            some: {
              userId: actorUserId,
              status: 'ACTIVE',
              removedAt: null,
              OR: [{ role: { in: ['OWNER', 'ADMIN'] } }, { id: membershipId }],
            },
          },
        },
      },
    });
  }

  findManageableOrganization(organizationId: string, actorUserId: string) {
    return this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: actorUserId,
        role: { in: ['OWNER', 'ADMIN'] },
        status: 'ACTIVE',
        removedAt: null,
        organization: { status: 'ACTIVE', deletedAt: null },
      },
      select: { id: true },
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

  createPendingCalendarEventAsset(data: {
    organizationId: string;
    bucket: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        ...data,
        byteSize: BigInt(data.byteSize),
        metadata: { status: 'pending', purpose: 'calendar-event-image' },
      },
    });
  }

  createPendingWebsiteSectionBackgroundAsset(data: {
    organizationId: string;
    bucket: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        ...data,
        byteSize: BigInt(data.byteSize),
        metadata: { status: 'pending', purpose: 'website-section-background' },
      },
    });
  }

  createPendingOrganizationLogoAsset(data: {
    organizationId: string;
    bucket: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }) {
    return this.prisma.mediaAsset.create({
      data: {
        ...data,
        byteSize: BigInt(data.byteSize),
        metadata: { status: 'pending', purpose: 'organization-logo' },
      },
    });
  }

  findAsset(assetId: string, organizationId: string) {
    return this.prisma.mediaAsset.findFirst({
      where: { id: assetId, organizationId, deletedAt: null },
    });
  }

  async confirmCalendarEventImage(organizationId: string, assetId: string, actorUserId: string) {
    const asset = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { metadata: { status: 'confirmed', purpose: 'calendar-event-image' } },
      select: { id: true },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: 'CONFIRM_CALENDAR_EVENT_IMAGE',
        entityType: 'MediaAsset',
        entityId: assetId,
        metadata: { assetId },
      },
    });
    return { assetId: asset.id };
  }

  async confirmWebsiteSectionBackground(
    organizationId: string,
    assetId: string,
    actorUserId: string,
  ) {
    const asset = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { metadata: { status: 'confirmed', purpose: 'website-section-background' } },
      select: { id: true },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId,
        actorUserId,
        action: 'CONFIRM_WEBSITE_SECTION_BACKGROUND',
        entityType: 'MediaAsset',
        entityId: assetId,
        metadata: { assetId },
      },
    });
    return { assetId: asset.id };
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

  async attachOrganizationLogo(organizationId: string, assetId: string, actorUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const currentWebsite = await tx.organizationWebsite.findUnique({
        where: { organizationId },
        select: {
          logoAssetId: true,
          organization: {
            select: {
              name: true,
              description: true,
            },
          },
        },
      });
      const organization =
        currentWebsite?.organization ??
        (await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: {
            name: true,
            description: true,
          },
        }));
      await tx.organizationWebsite.upsert({
        where: { organizationId },
        create: {
          organizationId,
          title: organization.name,
          description: organization.description,
          logoAssetId: assetId,
        },
        update: {
          logoAssetId: assetId,
        },
      });

      if (currentWebsite?.logoAssetId && currentWebsite.logoAssetId !== assetId) {
        await tx.mediaAsset.update({
          where: { id: currentWebsite.logoAssetId },
          data: { deletedAt: new Date() },
        });
      }

      await tx.mediaAsset.update({
        where: { id: assetId },
        data: { metadata: { status: 'confirmed', purpose: 'organization-logo' } },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId,
          action: 'UPDATE_ORGANIZATION_LOGO',
          entityType: 'Organization',
          entityId: organizationId,
          metadata: { assetId },
        },
      });

      return { assetId };
    });
  }
}
