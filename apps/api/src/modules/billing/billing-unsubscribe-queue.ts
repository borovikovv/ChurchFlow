import type { Prisma } from '@churchflow/db';

/**
 * Queued rather than written to a slot on the subscription: LiqPay may owe us more than one
 * cancellation at a time, and an order dropped here is an order that keeps charging a card.
 * Requeueing an order already listed reopens its row instead of adding a second one.
 *
 * It lives outside the repositories because two of them queue orders for the same reason - a
 * callback that supersedes an order, and a complimentary grant that replaces a paid subscription
 * - and both have to do it inside the transaction that makes the change they are reacting to.
 */
export function queueUnsubscribe(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; subscriptionId: string; orderId: string },
) {
  return tx.billingUnsubscribeRequest.upsert({
    where: { orderId: input.orderId },
    create: {
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      orderId: input.orderId,
    },
    update: { resolvedAt: null },
  });
}

/**
 * Closes a queued request once LiqPay has confirmed the order is no longer charging. Written
 * against the order rather than the request id, because the same order may have been queued by a
 * callback and by a cancellation before either was answered.
 */
export function resolveUnsubscribe(
  client: Pick<Prisma.TransactionClient, 'billingUnsubscribeRequest'>,
  orderId: string,
  resolvedAt: Date,
) {
  return client.billingUnsubscribeRequest.updateMany({
    where: { orderId, resolvedAt: null },
    data: { resolvedAt },
  });
}
