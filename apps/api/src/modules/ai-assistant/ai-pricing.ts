import { Prisma, type AiCostSource } from '@churchflow/db';

const TOKENS_PER_PRICE_UNIT = 1_000_000;

/**
 * List prices per million tokens, one row per price change. A row never changes once shipped: a
 * new price is a new row with a later effectiveFrom, and every usage record stores the version
 * it was costed with, so past months keep the cost they were charged at.
 */
export interface AiModelPrice {
  provider: string;
  model: string;
  version: string;
  effectiveFrom: Date;
  inputUsdPerMillion: string;
  /** Null when the provider bills cached input like any other input. */
  cachedInputUsdPerMillion: string | null;
  /** Reasoning tokens are part of the output tokens and are billed at this price too. */
  outputUsdPerMillion: string;
}

export const AI_MODEL_PRICES: readonly AiModelPrice[] = [
  {
    // OpenRouter model list, https://openrouter.ai/api/v1/models, read on 2026-09-30.
    provider: 'openrouter',
    model: 'deepseek/deepseek-v4.1-flash',
    version: 'openrouter-2026-09-30',
    effectiveFrom: new Date('2026-09-30T00:00:00.000Z'),
    inputUsdPerMillion: '0.30',
    cachedInputUsdPerMillion: '0.006',
    outputUsdPerMillion: '1.20',
  },
];

/** Tokens of one model call as the provider reported them; undefined means not reported. */
export interface AiModelCallUsage {
  inputTokens: number | undefined;
  cachedInputTokens: number | undefined;
  outputTokens: number | undefined;
  reasoningTokens: number | undefined;
  totalTokens: number | undefined;
}

export interface AiModelCallCost {
  costUsd: Prisma.Decimal | null;
  costSource: AiCostSource;
  pricingVersion: string | null;
}

export function findModelPrice(
  prices: readonly AiModelPrice[],
  provider: string,
  model: string,
  at: Date,
): AiModelPrice | null {
  return prices
    .filter(
      (price) =>
        price.provider === provider &&
        price.model === model &&
        price.effectiveFrom.getTime() <= at.getTime(),
    )
    .reduce<AiModelPrice | null>(
      (latest, price) =>
        !latest || price.effectiveFrom.getTime() > latest.effectiveFrom.getTime() ? price : latest,
      null,
    );
}

/**
 * The cost of one model call. What the provider says it charged wins; otherwise the price list
 * valid at the time of the call; otherwise the cost stays unknown rather than guessed. Token
 * counts are never estimated from text.
 */
export function modelCallCost(input: {
  usage: AiModelCallUsage;
  reportedCostUsd: number | null;
  price: AiModelPrice | null;
}): AiModelCallCost {
  const { usage, reportedCostUsd, price } = input;

  if (reportedCostUsd !== null) {
    return {
      costUsd: new Prisma.Decimal(String(reportedCostUsd)),
      costSource: 'PROVIDER_REPORTED',
      pricingVersion: null,
    };
  }

  if (!price || (usage.inputTokens === undefined && usage.outputTokens === undefined)) {
    return { costUsd: null, costSource: 'UNKNOWN', pricingVersion: null };
  }

  const inputTokens = usage.inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, inputTokens);
  const cachedPrice = price.cachedInputUsdPerMillion ?? price.inputUsdPerMillion;
  const cost = new Prisma.Decimal(inputTokens - cached)
    .times(price.inputUsdPerMillion)
    .plus(new Prisma.Decimal(cached).times(cachedPrice))
    .plus(new Prisma.Decimal(usage.outputTokens ?? 0).times(price.outputUsdPerMillion))
    .dividedBy(TOKENS_PER_PRICE_UNIT);

  return { costUsd: cost, costSource: 'PRICE_TABLE', pricingVersion: price.version };
}
