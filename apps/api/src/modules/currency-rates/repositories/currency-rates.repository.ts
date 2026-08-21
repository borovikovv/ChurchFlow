import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CurrencyRatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByDate(date: Date) {
    return this.prisma.currencyRate.findUnique({ where: { date } });
  }

  findLatest() {
    return this.prisma.currencyRate.findFirst({ orderBy: { date: 'desc' } });
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
