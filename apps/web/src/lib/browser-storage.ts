// Web storage is an external system with its own failure modes: Safari's private mode throws
// on write, embedded webviews can switch it off, and another tab may have left an unparsable
// value behind. Every access here is best effort, so a caller never has to guard.

export type StorageKind = 'local' | 'session';

export function readStoredJson<T>(
  kind: StorageKind,
  key: string,
  parse: (value: unknown) => T | null,
): T | null {
  const raw = resolveStorage(kind)?.getItem(key);
  if (raw === null || raw === undefined) {
    return null;
  }

  try {
    return parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    resolveStorage(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignored on purpose. See above.
  }
}

function resolveStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
