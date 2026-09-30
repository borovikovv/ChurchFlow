import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { JSONValue, LanguageModel, ProviderMetadata } from 'ai';
import { AI_ASSISTANT_DEFAULT_MODELS, type AiAssistantProvider } from '@churchflow/shared';

export interface AiLanguageModelSettings {
  provider: AiAssistantProvider;
  modelId: string;
  apiKey: string;
}

/**
 * The one place that turns provider settings into a model. The assistant and the benchmark both
 * build theirs here, so a benchmark run measures exactly what production calls.
 */
export function createLanguageModel(settings: AiLanguageModelSettings): LanguageModel {
  switch (settings.provider) {
    case 'openrouter':
      // Usage accounting makes OpenRouter report what each call actually cost.
      return createOpenRouter({ apiKey: settings.apiKey })(settings.modelId, {
        usage: { include: true },
      });
    case 'deepseek':
      // DeepSeek reports tokens, cache hits included, but no cost; the price table supplies it.
      return createDeepSeek({ apiKey: settings.apiKey })(settings.modelId);
  }
}

export function aiModelIdFor(
  provider: AiAssistantProvider,
  configured: string | undefined,
): string {
  return configured ?? AI_ASSISTANT_DEFAULT_MODELS[provider];
}

/**
 * Which provider and model answer the assistant, from configuration. Tools, prompts and the
 * agent loop only see a LanguageModel, so switching provider never touches them.
 */
@Injectable()
export class AiModelProvider {
  private model: LanguageModel | null = null;

  constructor(private readonly configService: ConfigService) {}

  get providerName(): AiAssistantProvider {
    return this.configService.getOrThrow<AiAssistantProvider>('AI_PROVIDER');
  }

  get modelId(): string {
    return aiModelIdFor(this.providerName, this.configService.get<string>('AI_MODEL'));
  }

  languageModel(): LanguageModel {
    if (!this.model) {
      const provider = this.providerName;
      this.model = createLanguageModel({
        provider,
        modelId: this.modelId,
        apiKey: this.configService.getOrThrow<string>(
          provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENROUTER_API_KEY',
        ),
      });
    }

    return this.model;
  }
}

/** The cost a provider reported for one step, when it reports one. */
export function reportedCostUsd(metadata: ProviderMetadata | undefined): number | null {
  const usage = metadata?.['openrouter']?.['usage'];
  if (!isJsonObject(usage)) return null;

  const cost = usage['cost'];
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : null;
}

function isJsonObject(
  value: JSONValue | undefined,
): value is { readonly [key: string]: JSONValue | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
