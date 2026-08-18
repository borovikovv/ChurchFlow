import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CALENDAR_SERVICE_ROLE_LABELS_BY_LOCALE,
  DEFAULT_APP_LOCALE,
  type AppLocale,
  type CalendarServiceRole,
  type NotificationPreferences,
  type TelegramNotificationLink,
} from '@churchflow/shared';
import {
  TelegramBotRepository,
  type ActivePrayerRequestRecord,
  type ActiveTelegramOrganizationRecord,
  type TelegramNotificationDelivery,
  type UpcomingServiceRecord,
} from './repositories/telegram-bot.repository';
import {
  CalendarRecurrenceError,
  expandCalendarEventOccurrences,
  zonedDateParts,
  zonedDateTimeToUtc,
} from '../calendar-events/recurrence/calendar-recurrence';

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
const LEGACY_SERVICES_MENU_BUTTON_TEXT = '📅 Графік служінь';
const LEGACY_PRAYER_REQUESTS_MENU_BUTTON_TEXT = '🙏 Молитовні потреби';
const SERVICES_ORGANIZATION_CALLBACK_PREFIX = 'services_org:';
const PRAYER_REQUESTS_ORGANIZATION_CALLBACK_PREFIX = 'prayers_org:';
const SERVICE_SCHEDULE_TIME_ZONE = 'Europe/Kyiv';
const SERVICE_SCHEDULE_MESSAGE_LIMIT = 3900;
const SERVICE_SEPARATOR = '──────────────';
const PRAYER_REQUESTS_MESSAGE_LIMIT = 3900;
const PRAYER_REQUEST_DESCRIPTION_LIMIT = 1800;

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

interface TelegramSendMessageOptions {
  replyMarkup?: TelegramReplyKeyboardMarkup | TelegramInlineKeyboardMarkup;
  parseMode?: 'HTML';
}

interface ServiceScheduleMessageBlock {
  kind: 'month' | 'service';
  text: string;
}

interface ServiceScheduleMessages {
  biblePassageLabel: string;
  emptySchedule: string;
  heading: string;
}

interface TelegramMenuMessages {
  prayerRequests: string;
  services: string;
}

interface TelegramCommonMessages {
  accountNotConnected: string;
  chooseOrganization: string;
  connectBeforeAction: string;
  connectBeforePrayerRequests: string;
  connectBeforeServices: string;
  connected: string;
  connectedStatus: string;
  deliveryDisabled: string;
  enabledFor: string;
  helpCommandDescription: string;
  helpHeading: string;
  invalidConnectionLink: string;
  noActiveOrganizations: string;
  startLinkInstructions: string;
  statusCommandDescription: string;
  stopped: string;
  stopCommandDescription: string;
  unknownCommand: string;
}

interface PrayerRequestsMessages {
  authorLabel: string;
  empty: string;
  heading: string;
}

type UpcomingServiceOccurrenceRecord = UpcomingServiceRecord;

interface TelegramLocaleConfig {
  common: TelegramCommonMessages;
  intlLocale: string;
  menu: TelegramMenuMessages;
  prayerRequests: PrayerRequestsMessages;
  serviceDateOrder: 'day-month' | 'month-day';
  serviceSchedule: ServiceScheduleMessages;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

const TELEGRAM_LOCALE_CONFIG = {
  en: {
    common: {
      accountNotConnected: 'This Telegram account is not connected to ChurchFlow.',
      chooseOrganization: 'Choose an organization:',
      connectBeforeAction: 'Connect this bot in ChurchFlow before using this action.',
      connectBeforePrayerRequests: 'Connect this bot in ChurchFlow before using /prayers.',
      connectBeforeServices: 'Connect this bot in ChurchFlow before using /services.',
      connected: 'Telegram notifications are connected to ChurchFlow.',
      connectedStatus: 'Connected to ChurchFlow.',
      deliveryDisabled: 'Telegram delivery is connected, but disabled in organization preferences.',
      enabledFor: 'Enabled for',
      helpCommandDescription: 'show this help',
      helpHeading: 'ChurchFlow bot commands:',
      invalidConnectionLink:
        'This connection link is invalid or expired. Create a new link in ChurchFlow.',
      noActiveOrganizations: 'You are not an active member of any organization.',
      startLinkInstructions:
        'Open ChurchFlow notification settings and tap Connect Telegram to link this bot.',
      statusCommandDescription: 'connection status',
      stopped: 'Telegram notifications are disabled.',
      stopCommandDescription: 'disable Telegram notifications',
      unknownCommand: 'Unknown command. Use /help to see available actions.',
    },
    intlLocale: 'en-US',
    menu: {
      prayerRequests: '🙏 Prayers',
      services: '📅 Service Schedule',
    },
    prayerRequests: {
      authorLabel: 'Requested by',
      empty: 'There are no active prayer requests yet.',
      heading: 'Prayers',
    },
    serviceDateOrder: 'month-day',
    serviceSchedule: {
      biblePassageLabel: 'Bible passage',
      emptySchedule: 'No services were found for this month and next month.',
      heading: 'Service schedule',
    },
  },
  uk: {
    common: {
      accountNotConnected: 'Цей Telegram акаунт не підключений до ChurchFlow.',
      chooseOrganization: 'Оберіть організацію:',
      connectBeforeAction: 'Підключіть цей бот у ChurchFlow перед використанням цієї дії.',
      connectBeforePrayerRequests: 'Підключіть цей бот у ChurchFlow перед використанням /prayers.',
      connectBeforeServices: 'Підключіть цей бот у ChurchFlow перед використанням /services.',
      connected: 'Telegram-сповіщення підключені до ChurchFlow.',
      connectedStatus: 'Підключено до ChurchFlow.',
      deliveryDisabled: 'Доставку в Telegram підключено, але вимкнено в налаштуваннях організації.',
      enabledFor: 'Увімкнено для',
      helpCommandDescription: 'показати цю довідку',
      helpHeading: 'Команди бота ChurchFlow:',
      invalidConnectionLink:
        'Це посилання для підключення недійсне або протерміноване. Створіть нове посилання в ChurchFlow.',
      noActiveOrganizations: 'Ви не є активним учасником жодної організації.',
      startLinkInstructions:
        'Відкрийте налаштування сповіщень ChurchFlow і натисніть Підключити Telegram.',
      statusCommandDescription: 'статус підключення',
      stopped: 'Telegram-сповіщення вимкнено.',
      stopCommandDescription: 'вимкнути Telegram-сповіщення',
      unknownCommand: 'Невідома команда. Використайте /help, щоб побачити доступні дії.',
    },
    intlLocale: 'uk-UA',
    menu: {
      prayerRequests: '🙏 Молитви',
      services: '📅 Графік служінь',
    },
    prayerRequests: {
      authorLabel: 'Просить',
      empty: 'Активних молитовних потреб поки немає.',
      heading: 'Молитви',
    },
    serviceDateOrder: 'day-month',
    serviceSchedule: {
      biblePassageLabel: 'Уривок',
      emptySchedule: 'На цей і наступний місяць служінь не знайдено.',
      heading: 'Графік служінь',
    },
  },
} as const satisfies Record<AppLocale, TelegramLocaleConfig>;

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

    if (isServicesMenuButton(text)) {
      await this.handleServices(chatId, telegramUserId);
      return;
    }

    if (isPrayerRequestsMenuButton(text)) {
      await this.handlePrayerRequests(chatId, telegramUserId);
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
      case '/prayers':
        await this.handlePrayerRequests(chatId, telegramUserId);
        return;
      case '/help':
        await this.sendHelp(chatId, telegramUserId);
        return;
      default:
        await this.sendMessage(chatId, telegramCommonMessages(DEFAULT_APP_LOCALE).unknownCommand);
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
        telegramCommonMessages(DEFAULT_APP_LOCALE).startLinkInstructions,
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
        telegramCommonMessages(DEFAULT_APP_LOCALE).invalidConnectionLink,
      );
      return;
    }

    const appLocale = appLocaleOrFallback(binding.user.locale);
    await this.sendMessage(input.chatId, telegramCommonMessages(appLocale).connected, {
      replyMarkup: mainMenuReplyMarkup(appLocale),
    });
  }

  private async handleStop(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    const appLocale = appLocaleOrFallback(binding?.user.locale);
    await this.telegramBotRepository.disableBindingByTelegramIdentity(telegramUserId, chatId);
    await this.sendMessage(chatId, telegramCommonMessages(appLocale).stopped);
  }

  private async handleStatus(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    if (!binding) {
      await this.sendMessage(
        chatId,
        telegramCommonMessages(DEFAULT_APP_LOCALE).accountNotConnected,
      );
      return;
    }
    const appLocale = appLocaleOrFallback(binding.user.locale);
    const messages = telegramCommonMessages(appLocale);

    const enabledOrganizations = binding.user.notificationPreferences
      .filter((preference) => preference.telegramEnabled)
      .map((preference) => preference.organization.name);
    const organizationsText =
      enabledOrganizations.length > 0
        ? `${messages.enabledFor}: ${enabledOrganizations.join(', ')}`
        : messages.deliveryDisabled;

    await this.sendMessage(chatId, `${messages.connectedStatus}\n${organizationsText}`, {
      replyMarkup: mainMenuReplyMarkup(appLocale),
    });
  }

  private async handleServices(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    if (!binding) {
      await this.sendMessage(
        chatId,
        telegramCommonMessages(DEFAULT_APP_LOCALE).connectBeforeServices,
      );
      return;
    }
    const appLocale = appLocaleOrFallback(binding.user.locale);

    const organizations = await this.telegramBotRepository.listActiveOrganizationsForUser(
      binding.userId,
    );
    if (organizations.length === 0) {
      await this.sendMessage(chatId, telegramCommonMessages(appLocale).noActiveOrganizations);
      return;
    }

    if (organizations.length > 1) {
      await this.sendMessage(chatId, telegramCommonMessages(appLocale).chooseOrganization, {
        replyMarkup: organizationSelectionMarkup(organizations),
      });
      return;
    }

    const [organization] = organizations;
    if (!organization) return;

    await this.sendServiceSchedule(chatId, binding.userId, organization.organizationId, appLocale);
  }

  private async handlePrayerRequests(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    if (!binding) {
      await this.sendMessage(
        chatId,
        telegramCommonMessages(DEFAULT_APP_LOCALE).connectBeforePrayerRequests,
      );
      return;
    }
    const appLocale = appLocaleOrFallback(binding.user.locale);

    const organizations = await this.telegramBotRepository.listActiveOrganizationsForUser(
      binding.userId,
    );
    if (organizations.length === 0) {
      await this.sendMessage(chatId, telegramCommonMessages(appLocale).noActiveOrganizations);
      return;
    }

    if (organizations.length > 1) {
      await this.sendMessage(chatId, telegramCommonMessages(appLocale).chooseOrganization, {
        replyMarkup: organizationSelectionMarkup(
          organizations,
          PRAYER_REQUESTS_ORGANIZATION_CALLBACK_PREFIX,
        ),
      });
      return;
    }

    const [organization] = organizations;
    if (!organization) return;

    await this.sendPrayerRequests(chatId, binding.userId, organization.organizationId, appLocale);
  }

  private async handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const callbackQueryId = callbackQuery.id;
    const chatId = callbackQuery.message?.chat.id ? String(callbackQuery.message.chat.id) : null;
    const telegramUserId = callbackQuery.from?.id ? String(callbackQuery.from.id) : '';
    const data = callbackQuery.data ?? '';

    try {
      if (!chatId || !telegramUserId) return;
      if (
        !data.startsWith(SERVICES_ORGANIZATION_CALLBACK_PREFIX) &&
        !data.startsWith(PRAYER_REQUESTS_ORGANIZATION_CALLBACK_PREFIX)
      ) {
        return;
      }

      const isPrayerRequestCallback = data.startsWith(PRAYER_REQUESTS_ORGANIZATION_CALLBACK_PREFIX);
      const organizationId = data
        .slice(
          isPrayerRequestCallback
            ? PRAYER_REQUESTS_ORGANIZATION_CALLBACK_PREFIX.length
            : SERVICES_ORGANIZATION_CALLBACK_PREFIX.length,
        )
        .trim();
      if (!organizationId) return;

      const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
        telegramUserId,
        chatId,
      );
      if (!binding) {
        await this.sendMessage(
          chatId,
          telegramCommonMessages(DEFAULT_APP_LOCALE).connectBeforeAction,
        );
        return;
      }
      const appLocale = appLocaleOrFallback(binding.user.locale);

      if (isPrayerRequestCallback) {
        await this.sendPrayerRequests(chatId, binding.userId, organizationId, appLocale);
      } else {
        await this.sendServiceSchedule(chatId, binding.userId, organizationId, appLocale);
      }
    } finally {
      await this.answerCallbackQuery(callbackQueryId);
    }
  }

  private async sendServiceSchedule(
    chatId: string,
    userId: string,
    organizationId: string,
    locale: string,
  ): Promise<void> {
    const { rangeStart, rangeEnd } = serviceScheduleRange(new Date());
    const services = await this.telegramBotRepository.listUpcomingServicesForOrganization({
      userId,
      organizationId,
      rangeStart,
      rangeEnd,
    });
    const serviceOccurrences = expandUpcomingServices(services, rangeStart, rangeEnd, this.logger);
    const appLocale = appLocaleOrFallback(locale);
    if (serviceOccurrences.length === 0) {
      await this.sendMessage(chatId, serviceScheduleMessages(appLocale).emptySchedule);
      return;
    }

    for (const message of formatUpcomingServices(serviceOccurrences, appLocale)) {
      await this.sendMessage(chatId, message, { parseMode: 'HTML' });
    }
  }

  private async sendHelp(chatId: string, telegramUserId: string) {
    const binding = await this.telegramBotRepository.findBindingByTelegramIdentity(
      telegramUserId,
      chatId,
    );
    const locale = appLocaleOrFallback(binding?.user.locale);
    const messages = telegramCommonMessages(locale);
    const menu = telegramMenuMessages(locale);

    return this.sendMessage(
      chatId,
      [
        messages.helpHeading,
        `${menu.services} or /services - ${serviceScheduleMessages(locale).heading}`,
        `${menu.prayerRequests} or /prayers - ${prayerRequestsMessages(locale).heading}`,
        `/status - ${messages.statusCommandDescription}`,
        `/stop - ${messages.stopCommandDescription}`,
        `/help - ${messages.helpCommandDescription}`,
      ].join('\n'),
      { replyMarkup: mainMenuReplyMarkup(locale) },
    );
  }

  private async sendMessage(
    chatId: string,
    text: string,
    options: TelegramSendMessageOptions = {},
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
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
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

  private async sendPrayerRequests(
    chatId: string,
    userId: string,
    organizationId: string,
    locale: AppLocale,
  ): Promise<void> {
    const requests = await this.telegramBotRepository.listActivePrayerRequestsForOrganization({
      userId,
      organizationId,
    });
    if (requests.length === 0) {
      await this.sendMessage(chatId, prayerRequestsMessages(locale).empty);
      return;
    }

    for (const message of formatPrayerRequests(requests, locale)) {
      await this.sendMessage(chatId, message, { parseMode: 'HTML' });
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

function expandUpcomingServices(
  services: UpcomingServiceRecord[],
  rangeStart: Date,
  rangeEnd: Date,
  logger: Pick<Logger, 'error'>,
): UpcomingServiceOccurrenceRecord[] {
  return services
    .flatMap((service) => {
      try {
        return expandCalendarEventOccurrences({
          event: service,
          rangeStart,
          rangeEnd,
          timeZone: SERVICE_SCHEDULE_TIME_ZONE,
        }).map((occurrence) => ({
          ...service,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
        }));
      } catch (error: unknown) {
        if (error instanceof CalendarRecurrenceError) {
          logger.error({
            event: 'Telegram service schedule recurrence expansion failed',
            organizationId: service.organizationId,
            calendarEventId: service.id,
            code: error.code,
            context: error.context,
          });
          return [];
        }

        throw error;
      }
    })
    .sort((left, right) => {
      const startsAtComparison = left.startsAt.getTime() - right.startsAt.getTime();
      return startsAtComparison === 0 ? left.id.localeCompare(right.id) : startsAtComparison;
    });
}

function formatUpcomingServices(
  services: UpcomingServiceOccurrenceRecord[],
  locale: AppLocale,
): string[] {
  const organizationName = escapeTelegramHtml(services[0]?.organization.name ?? 'ChurchFlow');
  const header = [
    `📅 <b>${escapeTelegramHtml(serviceScheduleMessages(locale).heading)}</b>`,
    organizationName,
  ].join('\n');
  const blocks = serviceScheduleBlocks(services, locale);

  return chunkTelegramHtmlBlocks(header, blocks, SERVICE_SCHEDULE_MESSAGE_LIMIT);
}

function isTelegramUpdate(value: unknown): value is TelegramUpdate {
  return typeof value === 'object' && value !== null;
}

function formatParticipants(
  service: UpcomingServiceOccurrenceRecord,
  locale: AppLocale,
): string | null {
  const participants = service.serviceDetails?.participants ?? [];
  if (participants.length === 0) return null;

  return participants
    .map(
      (participant) =>
        `<b>${escapeTelegramHtml(formatServiceRole(participant.role, locale))}:</b> ${escapeTelegramHtml(
          participant.displayNameSnapshot ?? participant.customName ?? 'Guest',
        )}`,
    )
    .join('\n');
}

function formatServiceRole(role: CalendarServiceRole, locale: AppLocale): string {
  return CALENDAR_SERVICE_ROLE_LABELS_BY_LOCALE[locale][role];
}

function notificationDetailUrl(url: string | null, notificationId: string | null): string | null {
  if (!url || !notificationId) return url;
  const separator = url.includes('?') ? '&' : '?';

  return `${url}${separator}notificationId=${encodeURIComponent(notificationId)}`;
}

function mainMenuReplyMarkup(locale: AppLocale): TelegramReplyKeyboardMarkup {
  const menu = telegramMenuMessages(locale);

  return {
    keyboard: [[{ text: menu.services }, { text: menu.prayerRequests }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function organizationSelectionMarkup(
  organizations: ActiveTelegramOrganizationRecord[],
  callbackPrefix = SERVICES_ORGANIZATION_CALLBACK_PREFIX,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: organizations.map((organization) => [
      {
        text: organization.organizationName,
        callback_data: `${callbackPrefix}${organization.organizationId}`,
      },
    ]),
  };
}

function formatPrayerRequests(requests: ActivePrayerRequestRecord[], locale: AppLocale): string[] {
  const organizationName = escapeTelegramHtml(requests[0]?.organization.name ?? 'ChurchFlow');
  const header = [
    `🙏 <b>${escapeTelegramHtml(prayerRequestsMessages(locale).heading)}</b>`,
    organizationName,
  ].join('\n');
  const blocks = requests.map((request) => formatPrayerRequestBlock(request, locale));

  return chunkTelegramTextBlocks(header, blocks, PRAYER_REQUESTS_MESSAGE_LIMIT);
}

function formatPrayerRequestBlock(request: ActivePrayerRequestRecord, locale: AppLocale): string {
  return [
    `<b>${escapeTelegramHtml(request.title)}</b>`,
    `<b>${escapeTelegramHtml(prayerRequestsMessages(locale).authorLabel)}:</b> ${escapeTelegramHtml(
      prayerRequestAuthorName(request),
    )}`,
    escapeTelegramHtml(truncateTelegramText(request.description, PRAYER_REQUEST_DESCRIPTION_LIMIT)),
  ].join('\n');
}

function prayerRequestAuthorName(request: ActivePrayerRequestRecord): string {
  return (
    request.authorMembership?.profile?.displayName ??
    request.authorMembership?.user?.displayName ??
    request.authorMembership?.user?.email ??
    request.author?.displayName ??
    request.author?.email ??
    'Member'
  );
}

function serviceScheduleBlocks(
  services: UpcomingServiceOccurrenceRecord[],
  locale: AppLocale,
): ServiceScheduleMessageBlock[] {
  const blocks: ServiceScheduleMessageBlock[] = [];
  let currentMonthKey: string | null = null;

  services.forEach((service) => {
    const monthKey = formatServiceMonthKey(service.startsAt);
    if (monthKey !== currentMonthKey) {
      blocks.push({ kind: 'month', text: formatMonthHeadingBlock(service.startsAt, locale) });
      currentMonthKey = monthKey;
    }

    blocks.push({ kind: 'service', text: formatServiceBlock(service, locale) });
  });

  return blocks;
}

function formatServiceBlock(service: UpcomingServiceOccurrenceRecord, locale: AppLocale): string {
  return [
    `<b>${escapeTelegramHtml(formatServiceDateTime(service.startsAt, locale))}</b>`,
    escapeTelegramHtml(service.title),
    formatBiblePassage(service, locale),
    formatParticipants(service, locale),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');
}

function formatBiblePassage(
  service: UpcomingServiceOccurrenceRecord,
  locale: AppLocale,
): string | null {
  const biblePassage = service.serviceDetails?.biblePassage?.trim();
  if (!biblePassage) return null;

  return `<b>${escapeTelegramHtml(
    serviceScheduleMessages(locale).biblePassageLabel,
  )}:</b> ${escapeTelegramHtml(biblePassage)}`;
}

function chunkTelegramHtmlBlocks(
  header: string,
  blocks: ServiceScheduleMessageBlock[],
  limit: number,
): string[] {
  const messages: string[] = [];
  let current = header;
  let previousBlockWasService = false;

  blocks.forEach((block) => {
    const separator = previousBlockWasService ? `\n\n${SERVICE_SEPARATOR}` : '';
    const candidate = `${current}${separator}\n\n${block.text}`;

    if (candidate.length <= limit || current.length === 0) {
      current = candidate;
    } else {
      messages.push(current);
      current = block.text;
    }

    previousBlockWasService = block.kind === 'service';
  });

  if (current.length > 0) messages.push(current);

  return messages;
}

function chunkTelegramTextBlocks(header: string, blocks: string[], limit: number): string[] {
  const messages: string[] = [];
  let current = header;

  blocks.forEach((block) => {
    const candidate = `${current}\n\n${SERVICE_SEPARATOR}\n\n${block}`;
    if (candidate.length <= limit || current.length === 0) {
      current = candidate;
    } else {
      messages.push(current);
      current = block;
    }
  });

  if (current.length > 0) messages.push(current);

  return messages;
}

function formatServiceMonthKey(value: Date): string {
  const parts = zonedDateParts(value, SERVICE_SCHEDULE_TIME_ZONE);

  return `${String(parts.year)}-${String(parts.month).padStart(2, '0')}`;
}

function formatServiceMonthHeading(value: Date, locale: AppLocale): string {
  const formatter = new Intl.DateTimeFormat(intlLocale(locale), {
    month: 'long',
    year: 'numeric',
    timeZone: SERVICE_SCHEDULE_TIME_ZONE,
  });

  return formatter.format(value).toLocaleUpperCase(intlLocale(locale));
}

function formatMonthHeadingBlock(value: Date, locale: AppLocale): string {
  return `<b>${escapeTelegramHtml(formatServiceMonthHeading(value, locale))}</b>`;
}

function formatServiceDateTime(value: Date, locale: AppLocale): string {
  const config = telegramLocaleConfig(locale);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(config.intlLocale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: SERVICE_SCHEDULE_TIME_ZONE,
    })
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const weekday = capitalizeLocale((parts['weekday'] ?? '').replace(/\.$/, ''), locale);
  const day = parts['day'] ?? '';
  const month = parts['month'] ?? '';
  const hour = parts['hour'] ?? '00';
  const minute = parts['minute'] ?? '00';

  const dateText = config.serviceDateOrder === 'day-month' ? `${day} ${month}` : `${month} ${day}`;

  return `${weekday}, ${dateText} · ${hour}:${minute}`;
}

function capitalizeLocale(value: string, locale: AppLocale): string {
  if (!value) return value;

  return `${value.slice(0, 1).toLocaleUpperCase(intlLocale(locale))}${value.slice(1)}`;
}

function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncateTelegramText(value: string, limit: number): string {
  if (value.length <= limit) return value;

  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function appLocaleOrFallback(locale: string | null | undefined): AppLocale {
  if (isTelegramAppLocale(locale)) return locale;

  return DEFAULT_APP_LOCALE;
}

function intlLocale(locale: AppLocale): string {
  return telegramLocaleConfig(locale).intlLocale;
}

function serviceScheduleMessages(locale: AppLocale): ServiceScheduleMessages {
  return telegramLocaleConfig(locale).serviceSchedule;
}

function telegramCommonMessages(locale: AppLocale): TelegramCommonMessages {
  return telegramLocaleConfig(locale).common;
}

function telegramMenuMessages(locale: AppLocale): TelegramMenuMessages {
  return telegramLocaleConfig(locale).menu;
}

function prayerRequestsMessages(locale: AppLocale): PrayerRequestsMessages {
  return telegramLocaleConfig(locale).prayerRequests;
}

function telegramLocaleConfig(locale: AppLocale): TelegramLocaleConfig {
  return TELEGRAM_LOCALE_CONFIG[locale];
}

function isServicesMenuButton(text: string): boolean {
  return (
    text === LEGACY_SERVICES_MENU_BUTTON_TEXT ||
    Object.values(TELEGRAM_LOCALE_CONFIG).some((config) => text === config.menu.services)
  );
}

function isPrayerRequestsMenuButton(text: string): boolean {
  return (
    text === LEGACY_PRAYER_REQUESTS_MENU_BUTTON_TEXT ||
    Object.values(TELEGRAM_LOCALE_CONFIG).some((config) => text === config.menu.prayerRequests)
  );
}

function isTelegramAppLocale(locale: string | null | undefined): locale is AppLocale {
  return (
    typeof locale === 'string' &&
    Object.prototype.hasOwnProperty.call(TELEGRAM_LOCALE_CONFIG, locale)
  );
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
