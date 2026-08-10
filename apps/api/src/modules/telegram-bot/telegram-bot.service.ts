import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CALENDAR_SERVICE_ROLE_LABELS,
  type CalendarServiceRole,
  type NotificationPreferences,
  type TelegramNotificationLink,
} from '@churchflow/shared';
import {
  TelegramBotRepository,
  type ActiveTelegramOrganizationRecord,
  type TelegramNotificationDelivery,
  type UpcomingServiceRecord,
} from './repositories/telegram-bot.repository';

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const SERVICES_MENU_BUTTON_TEXT = '📅 Графік служінь';
const SERVICES_ORGANIZATION_CALLBACK_PREFIX = 'services_org:';
const SERVICE_SCHEDULE_TIME_ZONE = 'Europe/Kyiv';

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  chat: { id: number | string };
  from?: {
    id: number | string;
    username?: string;
  };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from?: {
    id: number | string;
    username?: string;
  };
  message?: TelegramMessage;
  data?: string;
}

interface TelegramReplyKeyboardMarkup {
  keyboard: Array<Array<{ text: string }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
}

interface TelegramInlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly telegramBotRepository: TelegramBotRepository,
  ) {}

  async createLinkToken(userId: string): Promise<TelegramNotificationLink> {
    const username = this.botUsername();
    if (!username) {
      throw new ConflictException('Telegram bot is not configured');
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
    await this.telegramBotRepository.createLinkToken(userId, hashToken(token), expiresAt);

    return {
      url: `https://t.me/${username}?start=${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async disconnectUser(userId: string): Promise<NotificationPreferences['telegram']> {
    const binding = await this.telegramBotRepository.disconnectUserBinding(userId);
    if (!binding) {
      return {
        connected: false,
        enabled: false,
        username: null,
        blockedAt: null,
        revokedAt: null,
      };
    }

    return {
      connected: true,
      enabled: false,
      username: binding.username,
      blockedAt: binding.blockedAt?.toISOString() ?? null,
      revokedAt: binding.revokedAt?.toISOString() ?? null,
    };
  }

  async handleWebhook(secret: string, update: unknown) {
    const expectedSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expectedSecret || secret !== expectedSecret) {
      throw new ForbiddenException('Invalid Telegram webhook secret');
    }

    const parsedUpdate = isTelegramUpdate(update) ? update : null;
    const callbackQuery = parsedUpdate?.callback_query;
    if (callbackQuery) {
      await this.handleCallbackQuery(callbackQuery);
      return { ok: true };
    }

    const message = parsedUpdate?.message;
    if (!message?.text || !message.from) {
      return { ok: true };
    }

    await this.handleMessage(message);

    return { ok: true };
  }

  async deliverNotification(delivery: TelegramNotificationDelivery): Promise<void> {
    if (!this.botToken()) return;

    try {
      await this.sendMessage(delivery.chatId, this.formatNotificationDelivery(delivery));
    } catch (error: unknown) {
      await this.handleDeliveryError(delivery.chatId, error);
    }
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from?.id ?? '');
    const username = message.from?.username ?? null;
    const text = message.text?.trim() ?? '';

    if (!telegramUserId) return;

    if (text === SERVICES_MENU_BUTTON_TEXT) {
      await this.handleServices(chatId, telegramUserId);
      return;
    }

    const { command, payload } = parseCommand(text);
    if (!command) return;

    switch (command) {
      case '/start':
        await this.handleStart({ chatId, telegramUserId, username, payload });
        return;
      case '/stop':
        await this.handleStop(chatId, telegramUserId);
        return;
      case '/status':
        await this.handleStatus(chatId, telegramUserId);
        return;
      case '/services':
        await this.handleServices(chatId, telegramUserId);
        return;
      case '/help':
        await this.sendHelp(chatId);
        return;
      default:
        await this.sendMessage(chatId, 'Unknown command. Use /help to see available actions.');
    }
  }

  private async handleStart(input: {
    chatId: string;
    telegramUserId: string;
    username: string | null;
    payload: string | null;
  }) {
    if (!input.payload) {
      await this.sendMessage(
        input.chatId,
        'Open ChurchFlow notification settings and tap Connect Telegram to link this bot.',
      );
      return;
    }

    const binding = await this.telegramBotRepository.consumeLinkToken({
      tokenHash: hashToken(input.payload),
      telegramUserId: input.telegramUserId,
      telegramChatId: input.chatId,
      username: input.username,
    });
    if (!binding) {
      await this.sendMessage(
        input.chatId,
        'This connection link is invalid or expired. Create a new link in ChurchFlow.',
      );
      return;
    }

    await this.sendMessage(
      input.chatId,
      'Telegram notifications are connected to ChurchFlow.',
      mainMenuReplyMarkup(),
    );
  }

  private async handleStop(chatId: string, telegramUserId: string) {
    await this.telegramBotRepository.disableBindingByTelegramIdentity(telegramUserId, chatId);
    await this.sendMessage(chatId, 'Telegram notifications are disabled.');
  }

  private async handleStatus(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    if (!binding) {
      await this.sendMessage(chatId, 'This Telegram account is not connected to ChurchFlow.');
      return;
    }

    const enabledOrganizations = binding.user.notificationPreferences
      .filter((preference) => preference.telegramEnabled)
      .map((preference) => preference.organization.name);
    const organizationsText =
      enabledOrganizations.length > 0
        ? `Enabled for: ${enabledOrganizations.join(', ')}`
        : 'Telegram delivery is connected, but disabled in organization preferences.';

    await this.sendMessage(chatId, `Connected to ChurchFlow.\n${organizationsText}`);
  }

  private async handleServices(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    if (!binding) {
      await this.sendMessage(chatId, 'Connect this bot in ChurchFlow before using /services.');
      return;
    }

    const organizations = await this.telegramBotRepository.listActiveOrganizationsForUser(
      binding.userId,
    );
    if (organizations.length === 0) {
      await this.sendMessage(chatId, 'Ви не є активним учасником жодної організації.');
      return;
    }

    if (organizations.length > 1) {
      await this.sendMessage(
        chatId,
        'Оберіть організацію:',
        organizationSelectionMarkup(organizations),
      );
      return;
    }

    const [organization] = organizations;
    if (!organization) return;

    await this.sendServiceSchedule(chatId, binding.userId, organization.organizationId);
  }

  private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const callbackQueryId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat.id ? String(callbackQuery.message.chat.id) : null;
    const telegramUserId = callbackQuery.from?.id ? String(callbackQuery.from.id) : '';
    const data = callbackQuery.data ?? '';

    try {
      if (!chatId || !telegramUserId) return;
      if (!data.startsWith(SERVICES_ORGANIZATION_CALLBACK_PREFIX)) return;

      const organizationId = data.slice(SERVICES_ORGANIZATION_CALLBACK_PREFIX.length).trim();
      if (!organizationId) return;

      const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
        telegramUserId,
        chatId,
      );
      if (!binding) {
        await this.sendMessage(chatId, 'Connect this bot in ChurchFlow before using /services.');
        return;
      }

      await this.sendServiceSchedule(chatId, binding.userId, organizationId);
    } finally {
      await this.answerCallbackQuery(callbackQueryId);
    }
  }

  private async sendServiceSchedule(
    chatId: string,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const { rangeStart, rangeEnd } = serviceScheduleRange(new Date());
    const services = await this.telegramBotRepository.listUpcomingServicesForOrganization({
      userId,
      organizationId,
      rangeStart,
      rangeEnd,
    });
    if (services.length === 0) {
      await this.sendMessage(chatId, 'No upcoming services were found.');
      return;
    }

    await this.sendMessage(chatId, formatUpcomingServices(services));
  }

  private sendHelp(chatId: string) {
    return this.sendMessage(
      chatId,
      [
        'ChurchFlow bot commands:',
        `${SERVICES_MENU_BUTTON_TEXT} or /services - service schedule`,
        '/status - connection status',
        '/stop - disable Telegram notifications',
        '/help - show this help',
      ].join('\n'),
    );
  }

  private async sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: TelegramReplyKeyboardMarkup | TelegramInlineKeyboardMarkup,
  ): Promise<void> {
    const token = this.botToken();
    if (!token) {
      throw new ConflictException('Telegram bot is not configured');
    }

    const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    const body = (await response.json()) as TelegramApiResponse<unknown>;
    if (!response.ok || !body.ok) {
      throw new TelegramSendError(
        body.description ?? 'Telegram sendMessage failed',
        body.error_code ?? response.status,
      );
    }
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    const token = this.botToken();
    if (!token) {
      throw new ConflictException('Telegram bot is not configured');
    }

    const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
      }),
    });
    const body = (await response.json()) as TelegramApiResponse<unknown>;
    if (!response.ok || !body.ok) {
      throw new TelegramSendError(
        body.description ?? 'Telegram answerCallbackQuery failed',
        body.error_code ?? response.status,
      );
    }
  }

  private async handleDeliveryError(chatId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn({ event: 'Telegram delivery failed', chatId, error: message });

    if (
      error instanceof TelegramSendError &&
      (error.errorCode === 403 || error.errorCode === 400)
    ) {
      await this.telegramBotRepository.markBindingBlockedByChatId(chatId);
    }
  }

  private botToken(): string | undefined {
    return this.configService.get<string>('TELEGRAM_BOT_TOKEN');
  }

  private botUsername(): string | undefined {
    const username = this.configService.get<string>('TELEGRAM_BOT_USERNAME')?.trim();
    if (!username) return undefined;

    return username.startsWith('@') ? username.slice(1) : username;
  }

  private formatNotificationDelivery(delivery: TelegramNotificationDelivery): string {
    const url = notificationDetailUrl(delivery.url, delivery.notificationId);

    return [
      `ChurchFlow - ${delivery.organizationName}`,
      delivery.title,
      delivery.body,
      url ? this.absoluteNotificationUrl(url) : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');
  }

  private absoluteNotificationUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const webAppUrl = this.configService.get<string>('WEB_APP_URL');

    return webAppUrl ? new URL(url, webAppUrl).toString() : url;
  }
}

class TelegramSendError extends Error {
  constructor(
    message: string,
    readonly errorCode: number,
  ) {
    super(message);
  }
}

function parseCommand(text: string): { command: string | null; payload: string | null } {
  const [rawCommand, payload] = text.trim().split(/\s+/, 2);
  if (!rawCommand?.startsWith('/')) return { command: null, payload: null };
  const command = rawCommand.split('@', 1)[0] ?? null;
  if (!command) return { command: null, payload: payload ?? null };

  return { command: command.toLowerCase(), payload: payload ?? null };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function formatUpcomingServices(services: UpcomingServiceRecord[]): string {
  const organizationName = services[0]?.organization.name ?? 'ChurchFlow';
  const lines = [`Service schedule - ${organizationName}`];

  services.forEach((service, index) => {
    lines.push(
      [
        '',
        `${String(index + 1)}. ${service.title}`,
        formatDateTime(service.startsAt),
        formatParticipants(service),
      ]
        .filter((line): line is string => Boolean(line))
        .join('\n'),
    );
  });

  return lines.join('\n');
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: SERVICE_SCHEDULE_TIME_ZONE,
  }).format(value);
}

function formatParticipants(service: UpcomingServiceRecord): string | null {
  const participants = service.serviceDetails?.participants ?? [];
  if (participants.length === 0) return null;

  return participants
    .map(
      (participant) =>
        `${formatServiceRole(participant.role)}: ${participant.displayNameSnapshot ?? 'Guest'}`,
    )
    .join('\n');
}

function formatServiceRole(role: CalendarServiceRole): string {
  return CALENDAR_SERVICE_ROLE_LABELS[role];
}

function notificationDetailUrl(url: string | null, notificationId: string | null): string | null {
  if (!url || !notificationId) return url;
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}notificationId=${encodeURIComponent(notificationId)}`;
}

function mainMenuReplyMarkup(): TelegramReplyKeyboardMarkup {
  return {
    keyboard: [[{ text: SERVICES_MENU_BUTTON_TEXT }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function organizationSelectionMarkup(
  organizations: ActiveTelegramOrganizationRecord[],
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: organizations.map((organization) => [
      {
        text: organization.organizationName,
        callback_data: `${SERVICES_ORGANIZATION_CALLBACK_PREFIX}${organization.organizationId}`,
      },
    ]),
  };
}

function serviceScheduleRange(now: Date): { rangeStart: Date; rangeEnd: Date } {
  const parts = zonedDateParts(now, SERVICE_SCHEDULE_TIME_ZONE);
  const rangeEnd = zonedDateTimeToUtc(
    {
      year: parts.month >= 11 ? parts.year + 1 : parts.year,
      month: ((parts.month + 1) % 12) + 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    },
    SERVICE_SCHEDULE_TIME_ZONE,
  );

  return { rangeStart: now, rangeEnd };
}

function zonedDateTimeToUtc(
  parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  },
  timeZone: string,
): Date {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second),
  );
  const offset = timeZoneOffsetMs(utcGuess, timeZone);
  const adjusted = new Date(utcGuess.getTime() - offset);
  const adjustedOffset = timeZoneOffsetMs(adjusted, timeZone);

  return new Date(utcGuess.getTime() - adjustedOffset);
}

function timeZoneOffsetMs(value: Date, timeZone: string): number {
  const parts = zonedDateParts(value, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - value.getTime();
}

function zonedDateParts(value: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: parts['year'] ?? value.getUTCFullYear(),
    month: parts['month'] ?? value.getUTCMonth() + 1,
    day: parts['day'] ?? value.getUTCDate(),
    hour: parts['hour'] ?? value.getUTCHours(),
    minute: parts['minute'] ?? value.getUTCMinutes(),
    second: parts['second'] ?? value.getUTCSeconds(),
  };
}
