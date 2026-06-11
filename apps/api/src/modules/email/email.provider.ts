import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProviderSendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  send(input: EmailProviderSendInput): Promise<void>;
}

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  send(input: EmailProviderSendInput): Promise<void> {
    this.logger.log({
      event: 'Email would have been sent',
      recipient: input.to,
      subject: input.subject,
    });
    return Promise.resolve();
  }
}

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: EmailProviderSendInput): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.emailFrom,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error({
        event: 'Email delivery failed',
        recipient: input.to,
        subject: input.subject,
        status: response.status,
        body,
      });
      throw new Error('Email delivery failed');
    }
  }

  private get resendApiKey(): string {
    return this.config.getOrThrow<string>('RESEND_API_KEY');
  }

  private get emailFrom(): string {
    return this.config.getOrThrow<string>('EMAIL_FROM');
  }
}

export function createEmailProvider(config: ConfigService): EmailProvider {
  const configuredProvider = config.get<'resend' | 'console'>('EMAIL_PROVIDER');
  const resendApiKey = config.get<string>('RESEND_API_KEY');
  const emailFrom = config.get<string>('EMAIL_FROM');

  if (configuredProvider === 'resend' && resendApiKey && emailFrom) {
    return new ResendEmailProvider(config);
  }

  if (!configuredProvider && resendApiKey && emailFrom) {
    return new ResendEmailProvider(config);
  }

  return new ConsoleEmailProvider();
}
