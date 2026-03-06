export interface JwtPayload {
  sub: string;
  account: string;
  type?: 'user' | 'admin';
  merchantId?: string;
  launchSessionId?: string;
  launchMode?: 'callback';
  iat?: number;
  exp?: number;
}
