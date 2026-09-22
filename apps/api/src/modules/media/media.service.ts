import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENTITLEMENTS } from '@churchflow/shared';
import type {
  ConfirmUserAvatarUploadInput,
  CreateMemberPhotoUploadInput,
} from '@churchflow/shared';
import { EntitlementsService } from '../billing/entitlements.service';
import { publicWebsiteMediaUrl } from './public-media-url';
import { MediaRepository } from './repositories/media.repository';
import type { ReadUrlLookup, StoredObject } from './user-avatar-url';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicApiUrl: string;
  constructor(
    private readonly mediaRepository: MediaRepository,
    private readonly entitlementsService: EntitlementsService,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow('S3_BUCKET');
    this.publicApiUrl = config.getOrThrow('PUBLIC_API_URL');
    this.s3 = new S3Client({
      endpoint: config.getOrThrow('S3_ENDPOINT'),
      region: config.getOrThrow('S3_REGION'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow('S3_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async listForOrganization(organizationId: string) {
    return this.mediaRepository.listForOrganization(organizationId);
  }
  async createMemberPhotoUpload(
    organizationId: string,
    membershipId: string,
    input: CreateMemberPhotoUploadInput,
    actorUserId: string,
  ) {
    if (
      !(await this.mediaRepository.findPhotoUpdatableMember(
        organizationId,
        membershipId,
        actorUserId,
      ))
    )
      throw new ForbiddenException(
        'Only organization owners, admins, and the member can update member photos',
      );
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
      input.mimeType
    ];
    const objectKey = `organizations/${organizationId}/members/${membershipId}/${randomUUID()}.${extension}`;
    const asset = await this.mediaRepository.createPendingAsset({
      organizationId,
      membershipId,
      bucket: this.bucket,
      objectKey,
      ...input,
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresIn: 300 };
  }

  async createCalendarEventImageUpload(
    organizationId: string,
    input: CreateMemberPhotoUploadInput,
    actorUserId: string,
  ) {
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners and admins can upload event images');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
      input.mimeType
    ];
    const objectKey = `organizations/${organizationId}/calendar-events/${randomUUID()}.${extension}`;
    const asset = await this.mediaRepository.createPendingCalendarEventAsset({
      organizationId,
      bucket: this.bucket,
      objectKey,
      ...input,
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresIn: 300 };
  }

  async createWebsiteSectionBackgroundUpload(
    organizationId: string,
    input: CreateMemberPhotoUploadInput,
    actorUserId: string,
  ) {
    if (!(await this.mediaRepository.findOwnedOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners can upload website images');
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
      input.mimeType
    ];
    const objectKey = `organizations/${organizationId}/website-sections/${randomUUID()}.${extension}`;
    const asset = await this.mediaRepository.createPendingWebsiteSectionBackgroundAsset({
      organizationId,
      bucket: this.bucket,
      objectKey,
      ...input,
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresIn: 300 };
  }

  async createOrganizationLogoUpload(
    organizationId: string,
    input: CreateMemberPhotoUploadInput,
    actorUserId: string,
  ) {
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException(
        'Only organization owners and admins can update organization logos',
      );
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
      input.mimeType
    ];
    const objectKey = `organizations/${organizationId}/logo/${randomUUID()}.${extension}`;
    const asset = await this.mediaRepository.createPendingOrganizationLogoAsset({
      organizationId,
      bucket: this.bucket,
      objectKey,
      ...input,
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresIn: 300 };
  }

  async confirmMemberPhoto(
    organizationId: string,
    membershipId: string,
    assetId: string,
    actorUserId: string,
  ) {
    if (
      !(await this.mediaRepository.findPhotoUpdatableMember(
        organizationId,
        membershipId,
        actorUserId,
      ))
    )
      throw new ForbiddenException(
        'Only organization owners, admins, and the member can update member photos',
      );
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset || (asset.metadata as { membershipId?: string }).membershipId !== membershipId)
      throw new NotFoundException('Pending photo asset was not found');
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
    );
    if (head.ContentType !== asset.mimeType || head.ContentLength !== Number(asset.byteSize))
      throw new UnprocessableEntityException('Uploaded object does not match the declared photo');
    return this.mediaRepository.attachPhoto(organizationId, membershipId, assetId, actorUserId);
  }

  async confirmCalendarEventImage(organizationId: string, assetId: string, actorUserId: string) {
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners and admins can upload event images');
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset || (asset.metadata as { purpose?: string }).purpose !== 'calendar-event-image')
      throw new NotFoundException('Pending event image asset was not found');
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
    );
    if (head.ContentType !== asset.mimeType || head.ContentLength !== Number(asset.byteSize))
      throw new UnprocessableEntityException('Uploaded object does not match the declared image');
    return this.mediaRepository.confirmCalendarEventImage(organizationId, assetId, actorUserId);
  }

  async confirmWebsiteSectionBackground(
    organizationId: string,
    assetId: string,
    actorUserId: string,
  ) {
    if (!(await this.mediaRepository.findOwnedOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners can upload website images');
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset || (asset.metadata as { purpose?: string }).purpose !== 'website-section-background')
      throw new NotFoundException('Pending website image asset was not found');
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
    );
    if (head.ContentType !== asset.mimeType || head.ContentLength !== Number(asset.byteSize))
      throw new UnprocessableEntityException('Uploaded object does not match the declared image');
    return this.mediaRepository.confirmWebsiteSectionBackground(
      organizationId,
      assetId,
      actorUserId,
    );
  }

  async confirmOrganizationLogo(organizationId: string, assetId: string, actorUserId: string) {
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException(
        'Only organization owners and admins can update organization logos',
      );
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset || (asset.metadata as { purpose?: string }).purpose !== 'organization-logo')
      throw new NotFoundException('Pending organization logo asset was not found');
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
    );
    if (head.ContentType !== asset.mimeType || head.ContentLength !== Number(asset.byteSize))
      throw new UnprocessableEntityException('Uploaded object does not match the declared logo');
    return this.mediaRepository.attachOrganizationLogo(organizationId, assetId, actorUserId);
  }

  async getReadUrl(assetId: string, organizationId: string) {
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset) throw new NotFoundException('Media asset was not found');
    return {
      url: await this.signReadUrl(asset),
      expiresIn: 300,
    };
  }

  /**
   * The stable url a public surface publishes instead of a signed one. The asset still has to
   * exist inside the organization, so an image that was deleted leaves the page without an image
   * rather than with a link that answers 404. Whether the link may be served is decided again,
   * from the published website, each time it is followed.
   */
  async getPublicReadUrl(assetId: string, organizationId: string): Promise<string> {
    const asset = await this.mediaRepository.findAsset(assetId, organizationId);
    if (!asset) throw new NotFoundException('Media asset was not found');

    return publicWebsiteMediaUrl(this.publicApiUrl, asset.id);
  }

  async createUserAvatarUpload(userId: string, input: CreateMemberPhotoUploadInput) {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
      input.mimeType
    ];
    const objectKey = `users/${userId}/avatar/${randomUUID()}.${extension}`;
    const asset = await this.mediaRepository.createPendingUserAvatarAsset({
      userId,
      bucket: this.bucket,
      objectKey,
      ...input,
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.mimeType,
        ContentLength: input.byteSize,
      }),
      { expiresIn: 300 },
    );
    return { assetId: asset.id, uploadUrl, expiresIn: 300 };
  }

  async confirmUserAvatar(userId: string, input: ConfirmUserAvatarUploadInput) {
    const asset = await this.mediaRepository.findUserAsset(input.assetId);
    const metadata = (asset?.metadata ?? {}) as { purpose?: string; userId?: string };
    if (!asset || metadata.purpose !== 'user-avatar' || metadata.userId !== userId)
      throw new NotFoundException('Pending avatar asset was not found');
    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
    );
    if (head.ContentType !== asset.mimeType || head.ContentLength !== Number(asset.byteSize))
      throw new UnprocessableEntityException('Uploaded object does not match the declared avatar');
    await this.mediaRepository.attachUserAvatar(userId, asset.id);

    let copiedToMembershipId: string | null = null;
    if (input.organizationId) {
      try {
        copiedToMembershipId = await this.copyAvatarToMemberPhoto(
          input.organizationId,
          userId,
          asset,
        );
      } catch (error: unknown) {
        this.logger.error(
          `Avatar ${asset.id} could not be copied to the membership in organization ${input.organizationId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { assetId: asset.id, avatarUrl: await this.signReadUrl(asset), copiedToMembershipId };
  }

  async removeUserAvatar(userId: string) {
    await this.mediaRepository.clearUserAvatar(userId);
    return { ok: true };
  }

  async readUrlLookup(objects: Iterable<StoredObject | null | undefined>): Promise<ReadUrlLookup> {
    const distinct = new Map<string, StoredObject>();
    for (const object of objects) {
      if (object) distinct.set(`${object.bucket}/${object.objectKey}`, object);
    }
    const signed = new Map(
      await Promise.all(
        [...distinct].map(async ([key, object]) => [key, await this.signReadUrl(object)] as const),
      ),
    );
    return (object) =>
      object ? (signed.get(`${object.bucket}/${object.objectKey}`) ?? null) : null;
  }

  signReadUrl(asset: StoredObject): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
      { expiresIn: 300 },
    );
  }

  private async copyAvatarToMemberPhoto(
    organizationId: string,
    userId: string,
    asset: { id: string; objectKey: string; filename: string; mimeType: string; byteSize: bigint },
  ): Promise<string | null> {
    const membership = await this.mediaRepository.findMembershipWithoutPhoto(
      organizationId,
      userId,
    );
    if (!membership) return null;
    if (!(await this.entitlementsService.has(organizationId, ENTITLEMENTS.filesUpload)))
      return null;

    const extension = asset.objectKey.slice(asset.objectKey.lastIndexOf('.') + 1);
    const objectKey = `organizations/${organizationId}/members/${membership.id}/${randomUUID()}.${extension}`;
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeURI(`${this.bucket}/${asset.objectKey}`),
        Key: objectKey,
        ContentType: asset.mimeType,
        MetadataDirective: 'REPLACE',
      }),
    );
    await this.mediaRepository.attachCopiedMemberPhoto({
      organizationId,
      membershipId: membership.id,
      bucket: this.bucket,
      objectKey,
      filename: asset.filename,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      sourceAssetId: asset.id,
      actorUserId: userId,
    });
    return membership.id;
  }
}
