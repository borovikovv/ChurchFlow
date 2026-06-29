import { z } from 'zod';

export const consumePlatformAdminBootstrapSchema = z.object({
  token: z.string().min(32).max(512),
});

export class ConsumePlatformAdminBootstrapDto {
  static readonly schema = consumePlatformAdminBootstrapSchema;

  token!: string;
}
