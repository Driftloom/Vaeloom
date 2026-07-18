import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function deriveKey(secret: string): Buffer {
  return Buffer.from(secret.padEnd(KEY_LENGTH * 2, '0').slice(0, KEY_LENGTH * 2), 'utf8').subarray(0, KEY_LENGTH);
}

export function encryptSecret(plaintext: string, masterKey: string): string {
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptSecret(payload: string, masterKey: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed encrypted secret');
  const key = deriveKey(masterKey);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

/**
 * Verify a calendar webhook. Google sends a channel id + resource token; Outlook
 * sends a validation token / subscription id. We match the provider channel
 * id and resource token with a constant-time comparison when provided.
 */
export function verifyCalendarChannel(
  expectedChannelId: string,
  expectedResourceToken: string,
  channelId: string | undefined,
  resourceToken: string | undefined,
): boolean {
  if (!channelId || !resourceToken) return false;
  const a = Buffer.from(channelId);
  const b = Buffer.from(expectedChannelId);
  const c = Buffer.from(resourceToken);
  const d = Buffer.from(expectedResourceToken);
  if (a.length !== b.length || c.length !== d.length) return false;
  return timingSafeEqual(a, b) && timingSafeEqual(c, d);
}
