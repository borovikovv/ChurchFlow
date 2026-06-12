import { z } from 'zod';

const verifyEmailLoginDtoSchema = z.object({
  token: z.string().min(32).max(512),
});

export class VerifyEmailLoginDto {
  static readonly schema = verifyEmailLoginDtoSchema;

  token!: string;
}
