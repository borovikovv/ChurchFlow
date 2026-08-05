import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CreateMemberPhotoUploadInput } from '@churchflow/shared';
import { MediaRepository } from './repositories/media.repository';

@Injectable()
export class MediaService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  constructor(
    private readonly mediaRepository: MediaRepository,
    config: ConfigService,
  ) {
    this.bucket = config.getOrThrow('S3_BUCKET');
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
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners and admins can upload website images');
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
    if (!(await this.mediaRepository.findManageableOrganization(organizationId, actorUserId)))
      throw new ForbiddenException('Only organization owners and admins can upload website images');
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
      url: await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
        { expiresIn: 300 },
      ),
      expiresIn: 300,
    };
  }
}
