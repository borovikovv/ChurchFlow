import { createOrganizationLogoUploadSchema } from '@churchflow/shared';
import type { CreateOrganizationLogoUploadInput } from '@churchflow/shared';

export class CreateOrganizationLogoUploadDto implements CreateOrganizationLogoUploadInput {
  static readonly schema = createOrganizationLogoUploadSchema;
  filename!: string;
  mimeType!: CreateOrganizationLogoUploadInput['mimeType'];
  byteSize!: number;
}
