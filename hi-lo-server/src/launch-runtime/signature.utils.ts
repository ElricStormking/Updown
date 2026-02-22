import * as crypto from 'crypto';

export const generateSignature = (params: string[], hashKey: string): string => {
  const data = [...params, hashKey].join('&');
  return crypto.createHash('sha256').update(data).digest('hex');
};

