import { authProviderSchema } from '@churchflow/shared';
import { z } from 'zod';

export const providerLoginSchema = z.object({
  provider: authProviderSchema,
  providerToken: z.string().min(1),
  redirectTo: z.string().url().optional()
});

export class ProviderLoginDto {
  static readonly schema = providerLoginSchema;
}
