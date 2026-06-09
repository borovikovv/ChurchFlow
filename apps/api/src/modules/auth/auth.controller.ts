import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ProviderLoginDto, providerLoginSchema } from './dto/provider-login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('provider')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async providerLogin(@Body() body: ProviderLoginDto): Promise<{ provider: string }> {
    return this.authService.beginProviderLogin(providerLoginSchema.parse(body));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(): Promise<{ ok: true }> {
    // TODO: Revoke the session and clear httpOnly cookies.
    return { ok: true };
  }
}
