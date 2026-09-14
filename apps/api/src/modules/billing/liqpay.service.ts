import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LIQPAY_API_VERSION = 3;
const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout';
const LIQPAY_REQUEST_URL = 'https://www.liqpay.ua/api/request';
const LIQPAY_REQUEST_TIMEOUT_MS = 10_000;

/**
 * LiqPay answers an unsubscribe with 200 whether or not it stopped anything, so the body is what
 * decides. These codes mean there is nothing left to stop - the order is unknown to LiqPay, or it
 * was never recurring - and retrying them forever would keep a request queued that LiqPay will
 * never acknowledge. Every other code, and anything unrecognised, is retried instead: a queue
 * entry too many is noise, while one dropped early is a card charged in silence.
 */
const TERMINAL_UNSUBSCRIBE_ERRORS = new Set([
  'payment_not_found',
  'payment_not_subscribed',
  'order_id_empty',
]);

/** What LiqPay said about an order we asked it to stop charging. */
export type UnsubscribeOutcome =
  /** LiqPay accepted the cancellation. */
  | 'stopped'
  /** LiqPay has no recurring charge for this order, so there is nothing left to cancel. */
  | 'not-charging'
  /** Undecided: the request has to be repeated before the order can be considered stopped. */
  | 'retry';

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
  /** What was actually charged, so it can be checked against the price pinned at checkout. */
  amountMinor: number | null;
  currency: string | null;
  cardMask: string | null;
  cardBrand: string | null;
  /**
   * When LiqPay says the reported event happened, which is not when it reached us. Deliveries are
   * retried and can arrive in an order the events did not, so this is what orders them.
   */
  eventAt: Date | null;
}

/** What LiqPay says about an order when asked, rather than when it decides to tell us. */
export interface LiqPayOrderStatus {
  status: string;
  paymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  cardMask: string | null;
  cardBrand: string | null;
  eventAt: Date | null;
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);

  return null;
}

/** LiqPay reports amounts in major units, and as a number or a string depending on the call. */
function optionalAmountMinor(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

/** LiqPay stamps events in milliseconds since the epoch, as a number or as a string. */
function optionalTimestamp(value: unknown): Date | null {
  const millis = typeof value === 'string' ? Number(value) : value;
  if (typeof millis !== 'number' || !Number.isFinite(millis) || millis <= 0) {
    return null;
  }

  const at = new Date(millis);

  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * The completion time when the charge settled, falling back to when it was created. A charge that
 * never settled has only the latter, and ordering it by that is better than not ordering it.
 */
function callbackEventAt(record: Record<string, unknown>): Date | null {
  return optionalTimestamp(record['end_date']) ?? optionalTimestamp(record['create_date']);
}

/**
 * Signing, verification and the LiqPay calls we make. Kept free of database access so the
 * signature rules can be tested against LiqPay's documented fixtures on their own.
 */
@Injectable()
export class LiqPayService {
  private readonly logger = new Logger(LiqPayService.name);

  constructor(private readonly configService: ConfigService) {}

  isSandbox(): boolean {
    return (
      this.configService.get<string>('LIQPAY_MODE') === 'sandbox' &&
      Boolean(
        this.optionalKey('LIQPAY_PUBLIC_KEY')?.startsWith('sandbox_') &&
        this.optionalKey('LIQPAY_PRIVATE_KEY')?.startsWith('sandbox_'),
      )
    );
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
      status: optionalString(record['status'])?.trim().toLowerCase() ?? null,
      orderId: optionalString(record['order_id']),
      paymentId: optionalString(record['payment_id']),
      amountMinor: optionalAmountMinor(record['amount']),
      currency: optionalString(record['currency']),
      cardMask: optionalString(record['sender_card_mask2']),
      cardBrand: optionalString(record['sender_card_type']),
      eventAt: callbackEventAt(record),
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
      // Required rather than optional: a checkout without a callback address is one LiqPay
      // charges and never reports, leaving a paid organization with no subscription. Config
      // validation catches this at boot; this catches a process still running on older config.
      server_url: this.requiredKey('LIQPAY_CALLBACK_URL'),
      result_url: this.optionalKey('LIQPAY_RESULT_URL'),
    });

    return { checkoutUrl: LIQPAY_CHECKOUT_URL, data, signature };
  }

  /**
   * What LiqPay holds for an order, asked for rather than waited on. Nothing else can tell a
   * payment that genuinely failed from a callback that was never delivered, and that difference
   * is an organization which has paid being told it has not.
   *
   * Null for every answer that is not a readable status, the unreachable provider included. The
   * caller may only ever use this to credit a payment, never to condemn one: a `status` we could
   * not obtain must leave the organization exactly where the missing callback left it.
   */
  async queryOrderStatus(orderId: string): Promise<LiqPayOrderStatus | null> {
    try {
      const { data, signature } = this.encode({
        public_key: this.requiredKey('LIQPAY_PUBLIC_KEY'),
        version: LIQPAY_API_VERSION,
        action: 'status',
        order_id: orderId,
      });

      const response = await fetch(LIQPAY_REQUEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data, signature }).toString(),
        signal: AbortSignal.timeout(LIQPAY_REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn({
          event: 'LiqPay status request rejected',
          orderId,
          status: response.status,
        });

        return null;
      }

      const body = await readJsonObject(response);
      const status = optionalString(body?.['status'])?.trim().toLowerCase() ?? null;
      if (!body || !status) {
        this.logger.warn({ event: 'LiqPay status answered with an unreadable body', orderId });

        return null;
      }

      return {
        status,
        paymentId: optionalString(body['payment_id']),
        amountMinor: optionalAmountMinor(body['amount']),
        currency: optionalString(body['currency']),
        cardMask: optionalString(body['sender_card_mask2']),
        cardBrand: optionalString(body['sender_card_type']),
        eventAt: callbackEventAt(body),
      };
    } catch (error: unknown) {
      this.logger.warn({
        event: 'LiqPay status request failed',
        orderId,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return null;
    }
  }

  /**
   * Best effort by design. If LiqPay cannot be reached the local subscription is still moved on;
   * leaving our state stuck because a third party is down would be worse than a stale
   * subscription there, which the next callback reconciles. What the caller must not do is treat
   * an undecided answer as a cancellation, which is why this reports three outcomes rather than
   * a boolean: only `retry` means the order may still be charging.
   */
  async unsubscribe(orderId: string): Promise<UnsubscribeOutcome> {
    try {
      // Signing is inside the try for the same reason the request is: missing keys leave the
      // order charging exactly as an unreachable LiqPay does, and throwing here turned a
      // cancellation already saved and announced into an error for the person who asked for it.
      const { data, signature } = this.encode({
        public_key: this.requiredKey('LIQPAY_PUBLIC_KEY'),
        version: LIQPAY_API_VERSION,
        action: 'unsubscribe',
        order_id: orderId,
      });

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

        return 'retry';
      }

      return this.classifyUnsubscribe(orderId, await readJsonObject(response));
    } catch (error: unknown) {
      this.logger.warn({
        event: 'LiqPay unsubscribe failed',
        orderId,
        message: error instanceof Error ? error.message : 'unknown error',
      });

      return 'retry';
    }
  }

  private classifyUnsubscribe(
    orderId: string,
    body: Record<string, unknown> | null,
  ): UnsubscribeOutcome {
    if (!body) {
      this.logger.warn({ event: 'LiqPay unsubscribe answered with an unreadable body', orderId });

      return 'retry';
    }

    const result = optionalString(body['result'])?.toLowerCase() ?? null;
    const status = optionalString(body['status'])?.toLowerCase() ?? null;
    if (result === 'ok' || status === 'unsubscribed') {
      return 'stopped';
    }

    const errorCode = optionalString(body['err_code']) ?? optionalString(body['code']);
    const terminal = errorCode !== null && TERMINAL_UNSUBSCRIBE_ERRORS.has(errorCode.toLowerCase());

    this.logger.warn({
      event: terminal
        ? 'LiqPay has no recurring charge left for this order'
        : 'LiqPay unsubscribe was not accepted',
      orderId,
      result,
      status,
      errorCode,
    });

    return terminal ? 'not-charging' : 'retry';
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

/** LiqPay is not consistent about content types here, so the body is parsed rather than trusted. */
async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    return null;
  }

  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

/** LiqPay expects `YYYY-MM-DD HH:mm:ss` in UTC. */
function formatSubscribeDate(now: Date): string {
  return now.toISOString().slice(0, 19).replace('T', ' ');
}
