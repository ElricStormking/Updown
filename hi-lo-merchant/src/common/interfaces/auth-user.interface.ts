export interface AuthUser {
  userId: string;
  account: string;
  type?: 'user' | 'admin';
  merchantId?: string;
  launchSessionId?: string;
  launchMode?: 'legacy' | 'callback';
}
