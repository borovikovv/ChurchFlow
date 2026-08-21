import { Module } from '@nestjs/common';
import { CurrencyRatesService } from './currency-rates.service';
import { CurrencyRatesRepository } from './repositories/currency-rates.repository';

@Module({
  providers: [CurrencyRatesService, CurrencyRatesRepository],
  exports: [CurrencyRatesService],
})
export class CurrencyRatesModule {}
