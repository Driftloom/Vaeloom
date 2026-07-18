import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { createHmac, timingSafeEqual as hmacEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function deriveKey(secret: string): Buffer {
  return Buffer.from(secret.padEnd(KEY_LENGTH * 2, '0').slice(0, KEY_LENGTH * 2), 'utf8').subarray(0, KEY_LENGTH);
}

/** Encrypt a plaintext secret (e.g. an OAuth token) with AES-256-GCM. */
export function encryptSecret(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/** Decrypt a value previously produced by {@link encryptSecret}. */
export function decryptSecret(payload: string, masterKey: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted secret');
  }
  const key = deriveKey(masterKey);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Verify a Slack request signature. Slack signs each request with an HMAC
 * using the signing secret and the `v0:` versioned timestamp + raw body.
 */
export function verifySlackSignature(
  signingSecret: string,
  signature: string | undefined,
  timestamp: string | undefined,
  rawBody: string,
): boolean {
  if (!signature || !timestamp) return false;
  const fiveMinutes = 60 * 5;
  const ts = Number(timestamp);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > fiveMinutes) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = createHmac('sha256', signingSecret).update(base).digest('hex');
  const expected = `v0=${hmac}`;

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Constant-time string comparison used for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return hmacEqual(bufA, bufB);
}
