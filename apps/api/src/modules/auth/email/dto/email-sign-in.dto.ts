import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(255);

export const emailSignInRequestSchema = z.object({
  email: emailSchema,
  redirectTo: z.string().min(1).max(500).optional(),
});

export const emailSignInCodeSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the six digits from the email'),
});

type EmailSignInRequestInput = z.infer<typeof emailSignInRequestSchema>;
type EmailSignInCodeInput = z.infer<typeof emailSignInCodeSchema>;

export class EmailSignInRequestDto implements EmailSignInRequestInput {
  static readonly schema = emailSignInRequestSchema;

  email!: string;
  redirectTo?: string;
}

export class EmailSignInCodeDto implements EmailSignInCodeInput {
  static readonly schema = emailSignInCodeSchema;

  email!: string;
  code!: string;
}
