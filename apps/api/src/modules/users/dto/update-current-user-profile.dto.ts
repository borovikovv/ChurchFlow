import { updateCurrentUserProfileSchema } from '@churchflow/shared';
import type { UpdateCurrentUserProfileInput } from '@churchflow/shared';

export class UpdateCurrentUserProfileDto implements UpdateCurrentUserProfileInput {
  static readonly schema = updateCurrentUserProfileSchema;
  baptizedAt?: string | null;
  baptismChurchName?: string | null;
}
