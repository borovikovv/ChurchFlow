import { Body, Controller, Param, Post } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';

@Controller('telegram/webhook')
export class TelegramBotController {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  @Post(':secret')
  handleWebhook(@Param('secret') secret: string, @Body() body: unknown) {
    return this.telegramBotService.handleWebhook(secret, body);
  }
}
