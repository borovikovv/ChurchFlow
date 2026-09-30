require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { Reflector } = require('@nestjs/core');
const {
  AI_MODEL_PRICES,
  findModelPrice,
  isPeakTime,
  modelCallCost,
} = require('../dist/modules/ai-assistant/ai-pricing.js');
const {
  AiModelProvider,
  aiModelIdFor,
  createLanguageModel,
} = require('../dist/modules/ai-assistant/ai-model.provider.js');
const {
  AiAssistantAdminController,
} = require('../dist/modules/ai-assistant/ai-assistant-admin.controller.js');
const { AiAssistantService } = require('../dist/modules/ai-assistant/ai-assistant.service.js');
const { PlatformAdminGuard } = require('../dist/common/guards/platform-admin.guard.js');
const { SessionAuthGuard } = require('../dist/common/guards/session-auth.guard.js');
const { Prisma } = require('@churchflow/db');

// A Thursday, 12:00 UTC: outside DeepSeek's peak windows.
const AT = new Date('2026-10-01T12:00:00.000Z');

const PRICES = [
  {
    provider: 'openrouter',
    model: 'vendor/model-a',
    version: 'a-1',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    inputUsdPerMillion: '1.00',
    cachedInputUsdPerMillion: '0.10',
    outputUsdPerMillion: '2.00',
  },
  {
    provider: 'openrouter',
    model: 'vendor/model-a',
    version: 'a-2',
    effectiveFrom: new Date('2026-06-01T00:00:00.000Z'),
    inputUsdPerMillion: '0.50',
    cachedInputUsdPerMillion: null,
    outputUsdPerMillion: '1.00',
  },
  {
    provider: 'openrouter',
    model: 'vendor/model-b',
    version: 'b-1',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    inputUsdPerMillion: '3.00',
    cachedInputUsdPerMillion: '0.30',
    outputUsdPerMillion: '15.00',
  },
];

const usage = (input, cached, output) => ({
  inputTokens: input,
  cachedInputTokens: cached,
  outputTokens: output,
  reasoningTokens: undefined,
  totalTokens: input === undefined ? undefined : input + (output ?? 0),
});

test('the price in force at the time of the call is used, and older calls keep theirs', () => {
  const at = (iso) => findModelPrice(PRICES, 'openrouter', 'vendor/model-a', new Date(iso));

  assert.equal(at('2025-12-31T23:59:59.000Z'), null);
  assert.equal(at('2026-03-01T00:00:00.000Z').version, 'a-1');
  assert.equal(at('2026-06-01T00:00:00.000Z').version, 'a-2');
  assert.equal(findModelPrice(PRICES, 'other', 'vendor/model-a', new Date()), null);
});

test('different models are priced differently for the same tokens', () => {
  const tokens = usage(1_000_000, 0, 1_000_000);
  const at = new Date('2026-03-01T00:00:00.000Z');
  const cost = (model) =>
    modelCallCost({
      at: AT,
      usage: tokens,
      reportedCostUsd: null,
      price: findModelPrice(PRICES, 'openrouter', model, at),
    }).costUsd.toString();

  assert.equal(cost('vendor/model-a'), '3');
  assert.equal(cost('vendor/model-b'), '18');
});

test('cached input is billed at the cache price, or as input when there is none', () => {
  const withCachePrice = modelCallCost({
    at: AT,
    usage: usage(1_000_000, 800_000, 0),
    reportedCostUsd: null,
    price: PRICES[0],
  });
  const withoutCachePrice = modelCallCost({
    at: AT,
    usage: usage(1_000_000, 800_000, 0),
    reportedCostUsd: null,
    price: PRICES[1],
  });

  assert.equal(withCachePrice.costUsd.toString(), '0.28');
  assert.equal(withoutCachePrice.costUsd.toString(), '0.5');
});

test('a cache count above the input count cannot make the cost negative', () => {
  const cost = modelCallCost({
    at: AT,
    usage: usage(100, 500, 0),
    reportedCostUsd: null,
    price: PRICES[0],
  });

  assert.equal(cost.costUsd.toString(), '0.00001');
});

test('costs are decimal, not floating point', () => {
  const cost = modelCallCost({
    at: AT,
    usage: usage(100_000, 0, 200_000),
    reportedCostUsd: null,
    price: PRICES[2],
  });

  assert.ok(cost.costUsd instanceof Prisma.Decimal);
  assert.equal(cost.costUsd.toString(), '3.3');
});

test('what the provider charged wins over the price list', () => {
  const cost = modelCallCost({
    at: AT,
    usage: usage(10, 0, 10),
    reportedCostUsd: 0.000123,
    price: PRICES[0],
  });

  assert.deepEqual(
    { ...cost, costUsd: cost.costUsd.toString() },
    { costUsd: '0.000123', costSource: 'PROVIDER_REPORTED', pricingVersion: null },
  );
});

test('no usage and no reported cost leave the cost unknown instead of guessing it', () => {
  assert.deepEqual(
    modelCallCost({
      at: AT,
      usage: usage(undefined, undefined, undefined),
      reportedCostUsd: null,
      price: PRICES[0],
    }),
    { costUsd: null, costSource: 'UNKNOWN', pricingVersion: null },
  );
  assert.deepEqual(
    modelCallCost({ at: AT, usage: usage(10, 0, 10), reportedCostUsd: null, price: null }),
    {
      costUsd: null,
      costSource: 'UNKNOWN',
      pricingVersion: null,
    },
  );
});

test('every price row is well formed and versions are unique', () => {
  const versions = new Set();
  for (const price of AI_MODEL_PRICES) {
    for (const field of ['inputUsdPerMillion', 'outputUsdPerMillion']) {
      assert.ok(
        new Prisma.Decimal(price[field]).greaterThanOrEqualTo(0),
        `${price.version} ${field}`,
      );
    }
    assert.ok(!versions.has(price.version), `duplicate version ${price.version}`);
    versions.add(price.version);
  }
});

test('the usage report is closed to everyone but platform admins', () => {
  const guards = new Reflector().get('__guards__', AiAssistantAdminController);

  assert.deepEqual(guards, [SessionAuthGuard, PlatformAdminGuard]);
});

function reportService({ organizations = ['org-1'], subscription = null } = {}) {
  const queries = [];
  const decimal = (value) => (value === null ? null : new Prisma.Decimal(value));
  const repository = {
    organizationExists: async (id) => organizations.includes(id),
    findSubscriptionState: async () => subscription,
    findUsage: async (organizationId, periodStart) => {
      queries.push(['findUsage', organizationId, periodStart.toISOString()]);
      return 84;
    },
    usageReport: async (organizationId, periodStart) => {
      queries.push(['usageReport', organizationId, periodStart.toISOString()]);
      const sum = {
        inputTokens: 420000,
        cachedInputTokens: 180000,
        outputTokens: 67000,
        reasoningTokens: null,
        totalTokens: 487000,
        costUsd: decimal('0.4123456789'),
      };
      return {
        totals: { _count: 190, _sum: sum },
        byModel: [
          { provider: 'openrouter', model: 'deepseek/deepseek-v4.1-flash', _count: 190, _sum: sum },
        ],
        unknownCost: 2,
        requests: 95,
      };
    },
    usageHistory: async (organizationId) => {
      queries.push(['usageHistory', organizationId]);
      return {
        periods: [
          {
            billingPeriodStart: new Date('2026-09-15T00:00:00.000Z'),
            _sum: { totalTokens: 487000, costUsd: decimal('0.41') },
          },
        ],
        counters: [{ periodStart: new Date('2026-09-15T00:00:00.000Z'), used: 84 }],
      };
    },
  };
  const config = new Map([['AI_MONTHLY_ACTION_LIMIT', 250]]);
  const service = new AiAssistantService(
    { getOrThrow: (key) => config.get(key), get: (key) => config.get(key) },
    {},
    repository,
    { isEnforcementEnabled: () => true },
    {},
    {},
    {},
    {},
    {},
    {},
    {},
  );

  return { service, queries };
}

test('the report sums one organization and one billing period', async () => {
  const { service, queries } = reportService();

  const report = await service.adminUsageReport('org-1', {
    periodStart: '2026-09-15T00:00:00.000Z',
  });

  assert.deepEqual(
    {
      actionsUsed: report.actionsUsed,
      actionsLimit: report.actionsLimit,
      inputTokens: report.inputTokens,
      cachedInputTokens: report.cachedInputTokens,
      outputTokens: report.outputTokens,
      reasoningTokens: report.reasoningTokens,
      totalTokens: report.totalTokens,
      estimatedCostUsd: report.estimatedCostUsd,
      modelCalls: report.modelCalls,
      requests: report.requests,
      callsWithoutCost: report.callsWithoutCost,
      periodEnd: report.periodEnd,
    },
    {
      actionsUsed: 84,
      actionsLimit: 250,
      inputTokens: 420000,
      cachedInputTokens: 180000,
      outputTokens: 67000,
      reasoningTokens: 0,
      totalTokens: 487000,
      estimatedCostUsd: '0.412346',
      modelCalls: 190,
      requests: 95,
      callsWithoutCost: 2,
      periodEnd: '2026-10-15T00:00:00.000Z',
    },
  );
  assert.deepEqual(report.history, [
    {
      periodStart: '2026-09-15T00:00:00.000Z',
      actionsUsed: 84,
      totalTokens: 487000,
      estimatedCostUsd: '0.41',
    },
  ]);
  assert.ok(queries.every((query) => query[1] === 'org-1'));
});

test('without a period the report follows the organization billing period', async () => {
  const { service, queries } = reportService({
    subscription: {
      status: 'ACTIVE',
      isExempt: false,
      currentPeriodEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  });

  const report = await service.adminUsageReport('org-1', {});

  assert.ok(new Date(report.periodStart).getTime() <= Date.now());
  assert.ok(new Date(report.periodEnd).getTime() > Date.now());
  assert.equal(queries.find((query) => query[0] === 'usageReport')[2], report.periodStart);
});

test('an unknown organization is not found', async () => {
  const { service } = reportService();

  await assert.rejects(
    () => service.adminUsageReport('org-2', {}),
    (error) => error.getStatus() === 404,
  );
});

const deepSeekPrice = () =>
  findModelPrice(
    AI_MODEL_PRICES,
    'deepseek',
    'deepseek-flash',
    new Date('2026-10-01T00:00:00.000Z'),
  );

test('DeepSeek direct is billed at the peak rate on weekday peak hours and half of it otherwise', () => {
  const tokens = usage(1_000_000, 0, 1_000_000);
  const costAt = (iso) =>
    modelCallCost({
      usage: tokens,
      reportedCostUsd: null,
      price: deepSeekPrice(),
      at: new Date(iso),
    });

  // Thursday 02:00 and 09:59 UTC are peak; 04:00, 12:00 and a Saturday are not.
  assert.deepEqual(
    [
      '2026-10-01T02:00:00.000Z',
      '2026-10-01T09:59:00.000Z',
      '2026-10-01T04:00:00.000Z',
      '2026-10-01T12:00:00.000Z',
      '2026-10-03T02:00:00.000Z',
    ].map((iso) => [costAt(iso).costUsd.toString(), costAt(iso).pricingVersion]),
    [
      ['1.5', 'deepseek-2026-09-30'],
      ['1.5', 'deepseek-2026-09-30'],
      ['0.75', 'deepseek-2026-09-30/off-peak'],
      ['0.75', 'deepseek-2026-09-30/off-peak'],
      ['0.75', 'deepseek-2026-09-30/off-peak'],
    ],
  );
});

test('DeepSeek cache hits are billed at the cache rate of the hour', () => {
  const tokens = usage(1_000_000, 1_000_000, 0);
  const cost = modelCallCost({
    usage: tokens,
    reportedCostUsd: null,
    price: deepSeekPrice(),
    at: new Date('2026-10-01T02:00:00.000Z'),
  });

  assert.equal(cost.costUsd.toString(), '0.006');
});

test('peak windows are matched in UTC on the listed weekdays only', () => {
  const windows = [{ weekdaysUtc: [1, 2, 3, 4, 5], startHourUtc: 6, endHourUtc: 10 }];

  assert.equal(isPeakTime(windows, new Date('2026-10-05T06:00:00.000Z')), true);
  assert.equal(isPeakTime(windows, new Date('2026-10-05T10:00:00.000Z')), false);
  assert.equal(isPeakTime(windows, new Date('2026-10-04T07:00:00.000Z')), false);
});

test('each provider has its own id for DeepSeek V4.1 Flash unless one is configured', () => {
  assert.equal(aiModelIdFor('openrouter', undefined), 'deepseek/deepseek-v4.1-flash');
  assert.equal(aiModelIdFor('deepseek', undefined), 'deepseek-flash');
  assert.equal(aiModelIdFor('deepseek', 'deepseek-v4-pro'), 'deepseek-v4-pro');
  for (const provider of ['openrouter', 'deepseek']) {
    assert.ok(
      findModelPrice(AI_MODEL_PRICES, provider, aiModelIdFor(provider, undefined), AT),
      provider,
    );
  }
});

test('the configured provider decides the model and the key it is called with', () => {
  const modelFor = (config) => {
    const values = new Map(Object.entries(config));
    const provider = new AiModelProvider({
      get: (key) => values.get(key),
      getOrThrow: (key) => {
        if (!values.has(key)) throw new Error(`Missing ${key}`);
        return values.get(key);
      },
    });
    return { provider, model: provider.languageModel() };
  };

  const direct = modelFor({ AI_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'sk-deepseek' });
  assert.equal(direct.provider.modelId, 'deepseek-flash');
  assert.equal(direct.model.modelId, 'deepseek-flash');
  assert.match(direct.model.provider, /deepseek/);

  const routed = modelFor({ AI_PROVIDER: 'openrouter', OPENROUTER_API_KEY: 'sk-or' });
  assert.equal(routed.model.modelId, 'deepseek/deepseek-v4.1-flash');
  assert.match(routed.model.provider, /openrouter/);

  assert.throws(
    () => modelFor({ AI_PROVIDER: 'deepseek', OPENROUTER_API_KEY: 'sk-or' }),
    /DEEPSEEK_API_KEY/,
  );
  assert.ok(createLanguageModel({ provider: 'deepseek', modelId: 'deepseek-flash', apiKey: 'k' }));
});
