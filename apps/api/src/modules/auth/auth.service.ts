import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { providerLoginSchema } from './dto/provider-login.dto';

@Injectable()
export class AuthService {
  async beginProviderLogin(input: z.infer<typeof providerLoginSchema>): Promise<{ provider: string }> {
    // TODO: Verify provider assertions for Telegram, WebAuthn, email magic links, Google, or Apple.
    return { provider: input.provider };
  }
}
