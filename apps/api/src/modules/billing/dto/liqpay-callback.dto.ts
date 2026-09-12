import { z } from 'zod';

// LiqPay posts exactly two form fields. Everything else about the payment lives inside the
// base64 `data`, which is only trusted once `signature` checks out.
export class LiqPayCallbackDto {
  static readonly schema = z.object({
    data: z.string().min(1),
    signature: z.string().min(1),
  });

  data!: string;
  signature!: string;
}
