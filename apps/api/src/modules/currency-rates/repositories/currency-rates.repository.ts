import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CurrencyRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOnOrBefore(date: Date) {
    return this.prisma.currencyRate.findFirst({
      where: { date: { lte: date } },
      orderBy: { date: 'desc' },
    });
  }

  upsert(date: Date, usdToUah: number, eurToUah: number) {
    const data = { usdToUah, eurToUah };

    return this.prisma.currencyRate.upsert({
      where: { date },
      create: { date, ...data },
      update: data,
    });
  }
}
