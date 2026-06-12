import { z } from 'zod';

const startEmailLoginDtoSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  redirectTo: z.string().min(1).max(500).optional(),
});

export class StartEmailLoginDto {
  static readonly schema = startEmailLoginDtoSchema;

  email!: string;
  redirectTo?: string;
}
