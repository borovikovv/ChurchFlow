import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';

const CODE_DIGITS = 6;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export function generateEmailLoginCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');
}

// Six digits carry too little entropy for a plain digest: anyone holding a database dump
// could reverse every live code at once. A key derivation makes that search expensive
// enough to outlast the short window a code is valid for.
export async function hashEmailLoginCode(code: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await deriveCodeKey(code, salt);

  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyEmailLoginCode(code: string, storedHash: string): Promise<boolean> {
  const [saltHex, derivedHex] = storedHash.split(':');
  if (!saltHex || !derivedHex) {
    return false;
  }

  const expected = Buffer.from(derivedHex, 'hex');
  if (expected.length !== KEY_BYTES) {
    return false;
  }

  const derived = await deriveCodeKey(code, Buffer.from(saltHex, 'hex'));

  return timingSafeEqual(derived, expected);
}

function deriveCodeKey(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, KEY_BYTES, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}
