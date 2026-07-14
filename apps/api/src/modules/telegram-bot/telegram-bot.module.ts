import { Module } from '@nestjs/common';
import { TelegramBotController } from './telegram-bot.controller';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotRepository } from './repositories/telegram-bot.repository';

@Module({
  controllers: [TelegramBotController],
  providers: [TelegramBotService, TelegramBotRepository],
  exports: [TelegramBotService, TelegramBotRepository],
})
export class TelegramBotModule {}
