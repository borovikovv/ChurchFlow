import { authProviderSchema } from '@churchflow/shared';
import { z } from 'zod';

export const providerLoginSchema = z.object({
  provider: authProviderSchema,
  providerToken: z.string().min(1),
  redirectTo: z.string().min(1).max(500).optional(),
});

type ProviderLoginInput = z.infer<typeof providerLoginSchema>;

export class ProviderLoginDto implements ProviderLoginInput {
  static readonly schema = providerLoginSchema;

  provider!: ProviderLoginInput['provider'];
  providerToken!: string;
  redirectTo?: string;
}
