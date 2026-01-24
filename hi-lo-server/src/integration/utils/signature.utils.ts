import * as crypto from 'crypto';

export function generateSignature(params: string[], hashKey: string): string {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function validateSignature(
  params: string[],
  hashKey: string,
  providedHash: string,
): boolean {
  const expected = generateSignature(params, hashKey);
  return expected.toLowerCase() === providedHash.toLowerCase();
}

export function validateTimestamp(
  timestamp: number,
  toleranceSec: number = 10,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  return diff >= 0 && diff <= toleranceSec;
}

export function formatDateForSignature(date: Date): string {
  const pad = (n: number, len: number = 2) => n.toString().padStart(len, '0');
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    pad(date.getUTCMilliseconds(), 3)
  );
}
