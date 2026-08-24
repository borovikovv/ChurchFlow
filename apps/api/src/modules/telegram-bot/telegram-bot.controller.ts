import { Body, Controller, Param, Post } from '@nestjs/common';
import { RequestContextService } from '../../common/context/request-context.service';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram/webhook')
export class TelegramBotController {
  constructor(
    private readonly telegramBotService: TelegramBotService,
    private readonly context: RequestContextService,
  ) {}

  @Post(':secret')
  handleWebhook(@Param('secret') secret: string, @Body() body: unknown) {
    // Вебхук приходить без сесії: діє сам бот, а не користувач.
    return this.context.runAsSystem(() => this.telegramBotService.handleWebhook(secret, body));
  }
}
