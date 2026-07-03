import { confirmMemberPhotoUploadSchema, createMemberPhotoUploadSchema } from '@churchflow/shared';
import type {
  ConfirmMemberPhotoUploadInput,
  CreateMemberPhotoUploadInput,
} from '@churchflow/shared';

export class CreateMemberPhotoUploadDto implements CreateMemberPhotoUploadInput {
  static readonly schema = createMemberPhotoUploadSchema;
  filename!: string;
  mimeType!: CreateMemberPhotoUploadInput['mimeType'];
  byteSize!: number;
}
export class ConfirmMemberPhotoUploadDto implements ConfirmMemberPhotoUploadInput {
  static readonly schema = confirmMemberPhotoUploadSchema;
  assetId!: string;
}
