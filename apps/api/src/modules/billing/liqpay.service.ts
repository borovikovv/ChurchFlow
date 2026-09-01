import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LIQPAY_API_VERSION = 3;
const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';
const LIQPAY_REQUEST_URL = 'https://www.liqpay.ua/api/request';
const LIQPAY_REQUEST_TIMEOUT_MS = 10_000;

export interface LiqPayCheckout {
  checkoutUrl: string;
  data: string;
  signature: string;
}

export interface LiqPayCallback {
  action: string | null;
  status: string | null;
  orderId: string | null;
  paymentId: string | null;
  cardMask: string | null;
  cardBrand: string | null;
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);

  return null;
}

/**
 * Signing, verification and the two LiqPay calls we make. Kept free of database access so the
 * signature rules can be tested against LiqPay's documented fixtures on their own.
 */
@Injectable()
export class LiqPayService {
  private readonly logger = new Logger(LiqPayService.name);

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.optionalKey('LIQPAY_PUBLIC_KEY') && this.optionalKey('LIQPAY_PRIVATE_KEY'));
  }

  /** `base64(sha1(private_key + data + private_key))`, over the base64 `data` field itself. */
  sign(data: string): string {
    const privateKey = this.requiredKey('LIQPAY_PRIVATE_KEY');

    return createHash('sha1')
      .update(privateKey + data + privateKey)
      .digest('base64');
  }

  verifySignature(data: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(data), 'utf8');
    const received = Buffer.from(signature, 'utf8');

    // timingSafeEqual throws on a length mismatch, and the length itself is not a secret.
    if (expected.length !== received.length) {
      return false;
    }

    return timingSafeEqual(expected, received);
  }

  decodeCallback(data: string): LiqPayCallback | null {
    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    } catch {
      return null;
    }

    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const record = payload as Record<string, unknown>;

    return {
      action: optionalString(record['action']),
      status: optionalString(record['status']),
      orderId: optionalString(record['order_id']),
      paymentId: optionalString(record['payment_id']),
      cardMask: optionalString(record['sender_card_mask2']),
      cardBrand: optionalString(record['sender_card_type']),
    };
  }

  /**
   * Card details go to LiqPay's hosted checkout and never reach us. `subscribe` fixes the amount
   * and currency for the life of the subscription, which is why the caller pins them first.
   */
  buildSubscribeCheckout(input: {
    orderId: string;
    amountMinor: number;
    currency: string;
    description: string;
    now: Date;
  }): LiqPayCheckout {
    const { data, signature } = this.encode({
      public_key: this.requiredKey('LIQPAY_PUBLIC_KEY'),
      version: LIQPAY_API_VERSION,
      action: 'subscribe',
      amount: input.amountMinor / 100,
      currency: input.currency,
      description: input.description,
      order_id: input.orderId,
      subscribe: '1',
      subscribe_date_start: formatSubscribeDate(input.now),
      subscribe_periodicity: 'month',
      server_url: this.optionalKey('LIQPAY_CALLBACK_URL'),
      result_url: this.optionalKey('LIQPAY_RESULT_URL'),
    });

    return { checkoutUrl: LIQPAY_CHECKOUT_URL, data, signature };
  }

  /**
   * Best effort by design. If LiqPay cannot be reached the local subscription is still moved on;
   * leaving our state stuck because a third party is down would be worse than a stale
   * subscription there, which the next callback reconciles.
   */
  async unsubscribe(orderId: string): Promise<boolean> {
    const { data, signature } = this.encode({
      public_key: this.requiredKey('LIQPAY_PUBLIC_KEY'),
      version: LIQPAY_API_VERSION,
      action: 'unsubscribe',
      order_id: orderId,
    });

    try {
      const response = await fetch(LIQPAY_REQUEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data, signature }).toString(),
        signal: AbortSignal.timeout(LIQPAY_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn({
          event: 'LiqPay unsubscribe rejected',
          orderId,
          status: response.status,
        });

        return false;
      }

      return true;
    } catch (error: unknown) {
      this.logger.warn({
        event: 'LiqPay unsubscribe failed',
        orderId,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return false;
    }
  }

  private encode(payload: Record<string, unknown>): { data: string; signature: string } {
    const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    return { data, signature: this.sign(data) };
  }

  private optionalKey(name: string): string | undefined {
    return this.configService.get<string>(name);
  }

  private requiredKey(name: string): string {
    const value = this.optionalKey(name);
    if (!value) {
      throw new ServiceUnavailableException('Billing is not configured');
    }

    return value;
  }
}

/** LiqPay expects `YYYY-MM-DD HH:mm:ss` in UTC. */
function formatSubscribeDate(now: Date): string {
  return now.toISOString().slice(0, 19).replace('T', ' ');
}
