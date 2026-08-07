import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createConnection } from 'node:net';

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProviderSendInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  suppressFailureLog?: boolean;
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
      text: input.text,
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
      const providerMessage = this.parseProviderMessage(body);
      if (!input.suppressFailureLog) {
        this.logger.error({
          event: 'Email delivery failed',
          recipient: input.to,
          subject: input.subject,
          status: response.status,
          body,
        });
      }
      throw new BadGatewayException(`Email delivery failed: ${providerMessage}`);
    }
  }

  private parseProviderMessage(body: string): string {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'message' in parsed &&
        typeof parsed.message === 'string'
      ) {
        return parsed.message;
      }
    } catch {
      // Fall through to the generic body handling below.
    }

    return body.trim() || 'Email provider rejected the message';
  }

  private get resendApiKey(): string {
    return this.config.getOrThrow<string>('RESEND_API_KEY');
  }

  private get emailFrom(): string {
    return this.config.getOrThrow<string>('EMAIL_FROM');
  }
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: EmailProviderSendInput): Promise<void> {
    const message = this.buildMessage(input);
    const fromAddress = this.extractEnvelopeAddress(this.emailFrom);
    const toAddress = this.extractEnvelopeAddress(input.to);

    const socket = createConnection({
      host: this.smtpHost,
      port: this.smtpPort,
    });
    socket.setEncoding('utf8');

    try {
      await this.readResponse(socket, 220);
      await this.sendCommand(socket, 'EHLO localhost', 250);
      await this.sendCommand(socket, `MAIL FROM:<${fromAddress}>`, 250);
      await this.sendCommand(socket, `RCPT TO:<${toAddress}>`, 250);
      await this.sendCommand(socket, 'DATA', 354);
      await this.sendCommand(socket, `${message}\r\n.`, 250);
      await this.sendCommand(socket, 'QUIT', 221);
    } catch (error: unknown) {
      if (!input.suppressFailureLog) {
        this.logger.error({
          event: 'SMTP email delivery failed',
          recipient: input.to,
          subject: input.subject,
          host: this.smtpHost,
          port: this.smtpPort,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw new BadGatewayException(
        error instanceof Error ? error.message : 'SMTP email delivery failed',
      );
    } finally {
      socket.end();
      socket.destroy();
    }
  }

  private async sendCommand(
    socket: ReturnType<typeof createConnection>,
    command: string,
    expectedCode: number,
  ) {
    socket.write(`${command}\r\n`);
    await this.readResponse(socket, expectedCode);
  }

  private readResponse(
    socket: ReturnType<typeof createConnection>,
    expectedCode: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      const cleanup = () => {
        socket.off('data', onData);
        socket.off('error', onError);
      };

      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const onData = (chunk: string | Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n').filter(Boolean);
        const lastLine = lines.at(-1);
        if (!lastLine) return;

        const match = lastLine.match(/^(\d{3})([ -])/);
        if (!match) return;
        if (match[2] !== ' ') return;

        cleanup();
        const code = Number(match[1]);
        if (code !== expectedCode) {
          reject(
            new Error(
              `SMTP server responded with ${String(code)} instead of ${String(expectedCode)}: ${lastLine}`,
            ),
          );
          return;
        }

        resolve();
      };

      socket.on('data', onData);
      socket.on('error', onError);
    });
  }

  private buildMessage(input: EmailProviderSendInput): string {
    const normalizedText = input.text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');

    return [
      `From: ${this.emailFrom}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      normalizedText,
    ].join('\r\n');
  }

  private extractEnvelopeAddress(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/<([^>]+)>/);
    return match?.[1] ?? trimmed;
  }

  private get emailFrom(): string {
    return normalizeConfigValue(this.config.getOrThrow<string>('EMAIL_FROM')) ?? '';
  }

  private get smtpHost(): string {
    return normalizeConfigValue(this.config.getOrThrow<string>('SMTP_HOST')) ?? '';
  }

  private get smtpPort(): number {
    return this.config.getOrThrow<number>('SMTP_PORT');
  }
}

function normalizeConfigValue(value: string | undefined): string | undefined {
  if (!value) return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function createEmailProvider(config: ConfigService): EmailProvider {
  const configuredProvider = normalizeConfigValue(config.get<string>('EMAIL_PROVIDER'));
  const resendApiKey = normalizeConfigValue(config.get<string>('RESEND_API_KEY'));
  const emailFrom = normalizeConfigValue(config.get<string>('EMAIL_FROM'));
  const smtpHost = normalizeConfigValue(config.get<string>('SMTP_HOST'));
  const smtpPort = config.get<number>('SMTP_PORT');

  if (configuredProvider === 'console') {
    return new ConsoleEmailProvider();
  }

  if (configuredProvider === 'smtp' && emailFrom && smtpHost && smtpPort) {
    return new SmtpEmailProvider(config);
  }

  if (configuredProvider === 'resend' && resendApiKey && emailFrom) {
    return new ResendEmailProvider(config);
  }

  if (configuredProvider === 'smtp') {
    throw new Error('EMAIL_FROM, SMTP_HOST, and SMTP_PORT are required when EMAIL_PROVIDER=smtp');
  }

  if (configuredProvider === 'resend') {
    throw new Error('RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend');
  }

  if (configuredProvider === undefined && emailFrom && smtpHost && smtpPort) {
    return new SmtpEmailProvider(config);
  }

  if (configuredProvider === undefined && resendApiKey && emailFrom) {
    return new ResendEmailProvider(config);
  }

  return new ConsoleEmailProvider();
}
