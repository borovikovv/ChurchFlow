import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

/**
 * Encrypts a secret for storage. The output carries its own version, iv and auth tag, so a
 * tampered or truncated value fails to decrypt instead of decrypting to garbage.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSecret(stored: string, key: Buffer): string {
  const [version, iv, tag, ciphertext, ...rest] = stored.split(':');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined || rest.length > 0) {
    throw new Error('Unsupported encrypted secret format');
  }

  // GCM would otherwise accept a truncated tag, which is far easier to forge.
  const authTag = Buffer.from(tag, 'base64url');
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Unsupported encrypted secret format');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'), {
    authTagLength: AUTH_TAG_BYTES,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
