import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ServiceTokenPayload {
  serviceName: string;
  iat: number;
  exp: number;
}

export function generateServiceToken(serviceName: string, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60;
  const payload = Buffer.from(JSON.stringify({ serviceName, iat, exp } satisfies ServiceTokenPayload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyServiceToken(token: string, secret: string): ServiceTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [header, payload, signature] = parts as [string, string, string];
  const expectedSig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new Error('Invalid token signature');
  }
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as ServiceTokenPayload;
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
}
