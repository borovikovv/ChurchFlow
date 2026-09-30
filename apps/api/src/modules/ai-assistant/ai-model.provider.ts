import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { JSONValue, LanguageModel, ProviderMetadata } from 'ai';

/**
 * The one place that knows which provider and model answer the assistant. Tools, prompts and the
 * agent loop only see a LanguageModel, so switching provider is configuration plus a branch here.
 */
@Injectable()
export class AiModelProvider {
  private model: LanguageModel | null = null;

  constructor(private readonly configService: ConfigService) {}

  get providerName(): string {
    return this.configService.getOrThrow<string>('AI_PROVIDER');
  }

  get modelId(): string {
    return this.configService.getOrThrow<string>('AI_MODEL');
  }

  languageModel(): LanguageModel {
    if (!this.model) {
      const openrouter = createOpenRouter({
        apiKey: this.configService.getOrThrow<string>('OPENROUTER_API_KEY'),
      });
      // Usage accounting makes OpenRouter report what each call actually cost.
      this.model = openrouter(this.modelId, { usage: { include: true } });
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
