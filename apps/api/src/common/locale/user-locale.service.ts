import { Injectable } from '@nestjs/common';
import { appLocaleOrFallback, DEFAULT_APP_LOCALE, type AppLocale } from '@churchflow/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserLocaleService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string | null | undefined): Promise<AppLocale> {
    if (!userId) return DEFAULT_APP_LOCALE;

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { locale: true },
    });

    return appLocaleOrFallback(user?.locale);
  }

  async forEmail(email: string | null | undefined): Promise<AppLocale | null> {
    if (!email) return null;

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { locale: true },
    });

    return user ? appLocaleOrFallback(user.locale) : null;
  }

  // Mail addressed to someone who has no account yet cannot be localised from their own
  // preference, so it falls back to whoever triggered the send.
  async forRecipient(
    email: string | null | undefined,
    fallbackUserId: string | null | undefined,
  ): Promise<AppLocale> {
    return (await this.forEmail(email)) ?? (await this.forUser(fallbackUserId));
  }
}
