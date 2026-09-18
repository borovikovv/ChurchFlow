import { confirmUserAvatarUploadSchema } from '@churchflow/shared';
import type { ConfirmUserAvatarUploadInput } from '@churchflow/shared';

export class ConfirmUserAvatarUploadDto implements ConfirmUserAvatarUploadInput {
  static readonly schema = confirmUserAvatarUploadSchema;
  assetId!: string;
  organizationId?: string;
}
