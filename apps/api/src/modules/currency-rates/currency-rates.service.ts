import { Injectable, Logger } from '@nestjs/common';
import type { ExchangeRates } from '@churchflow/shared';
import { CurrencyRatesRepository } from './repositories/currency-rates.repository';

const NBU_EXCHANGE_URL = 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange';
const NBU_TIMEOUT_MS = 5_000;

type NbuRate = { cc?: unknown; rate?: unknown };

@Injectable()
export class CurrencyRatesService {
  private readonly logger = new Logger(CurrencyRatesService.name);

  constructor(private readonly currencyRatesRepository: CurrencyRatesRepository) {}

  getCurrent(now: Date = new Date()): Promise<ExchangeRates | null> {
    return this.getOnOrBefore(startOfUtcDay(now));
  }

  async getOnOrBefore(date: Date): Promise<ExchangeRates | null> {
    const day = startOfUtcDay(date);
    const stored = await this.currencyRatesRepository.findOnOrBefore(day);
    if (stored && stored.date.getTime() === day.getTime()) {
      return toExchangeRates(stored);
    }

    const fetched = await this.fetchFromNbu(day);
    if (fetched) {
      return toExchangeRates(
        await this.currencyRatesRepository.upsert(day, fetched.usdToUah, fetched.eurToUah),
      );
    }

    return stored ? toExchangeRates(stored) : null;
  }

  getForMonth(year: number, month: number, now: Date = new Date()): Promise<ExchangeRates | null> {
    return this.getOnOrBefore(monthRateDate(year, month, now));
  }

  async getForMonths(
    year: number,
    months: number[],
    now: Date = new Date(),
  ): Promise<Map<number, ExchangeRates | null>> {
    const entries = await Promise.all(
      months.map(async (month) => [month, await this.getForMonth(year, month, now)] as const),
    );

    return new Map(entries);
  }

  private async fetchFromNbu(date: Date): Promise<{ usdToUah: number; eurToUah: number } | null> {
    try {
      const response = await fetch(`${NBU_EXCHANGE_URL}?json&date=${toNbuDate(date)}`, {
        signal: AbortSignal.timeout(NBU_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`NBU exchange request failed with status ${String(response.status)}`);
        return null;
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) {
        this.logger.warn('NBU exchange response was not a list');
        return null;
      }

      const usdToUah = findRate(payload, 'USD');
      const eurToUah = findRate(payload, 'EUR');
      if (usdToUah === null || eurToUah === null) {
        this.logger.warn('NBU exchange response is missing USD or EUR');
        return null;
      }

      return { usdToUah, eurToUah };
    } catch (error) {
      this.logger.warn(`NBU exchange request failed: ${describeError(error)}`);
      return null;
    }
  }
}

export function monthRateDate(year: number, month: number, now: Date): Date {
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const today = startOfUtcDay(now);

  return monthEnd.getTime() < today.getTime() ? monthEnd : today;
}

function findRate(entries: unknown[], code: string): number | null {
  for (const entry of entries) {
    const rate = entry as NbuRate;
    if (rate.cc !== code) continue;
    const value = Number(rate.rate);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  return null;
}

function toExchangeRates(record: {
  date: Date;
  usdToUah: { toString(): string };
  eurToUah: { toString(): string };
}): ExchangeRates {
  return {
    date: record.date.toISOString().slice(0, 10),
    usdToUah: Number(record.usdToUah.toString()),
    eurToUah: Number(record.eurToUah.toString()),
  };
}

function toNbuDate(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
