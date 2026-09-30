import type { Prisma } from '@churchflow/db';

/** What a stored message looked like when it was loaded, to tell a changed message from an old one. */
export interface AiStoredMessageState {
  position: number;
  fingerprint: string;
}

export interface AiTurnMessage {
  clientId: string;
  role: string;
  parts: Prisma.InputJsonValue;
}

export interface AiTurnWrites {
  upserts: (AiTurnMessage & { position: number })[];
  removedClientIds: string[];
}

/**
 * JSON with object keys sorted. Postgres stores Json as jsonb, which reorders keys, so comparing
 * a loaded message with the one about to be saved has to ignore key order.
 */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }

  return JSON.stringify(value ?? null);
}

/**
 * The writes one turn needs. Only messages that are new or changed are written, so a long
 * conversation does not rewrite its whole history on every reply. Nothing is deleted except the
 * messages a retry explicitly replaced: a message that failed to load, or one saved meanwhile
 * from another tab, is left where it is.
 */
export function planTurnWrites(input: {
  stored: ReadonlyMap<string, AiStoredMessageState>;
  nextPosition: number;
  messages: AiTurnMessage[];
  replacedClientIds: readonly string[];
}): AiTurnWrites {
  let nextPosition = input.nextPosition;
  const upserts: AiTurnWrites['upserts'] = [];

  for (const message of input.messages) {
    const stored = input.stored.get(message.clientId);
    if (stored && stored.fingerprint === stableJson(message.parts)) continue;

    upserts.push({ ...message, position: stored?.position ?? nextPosition++ });
  }

  const kept = new Set(input.messages.map((message) => message.clientId));

  return {
    upserts,
    removedClientIds: input.replacedClientIds.filter((clientId) => !kept.has(clientId)),
  };
}
