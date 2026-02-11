import type { UserWithWallet } from '../../users/users.service';

export interface AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    account: string;
    merchantId: string;
    isAdmin: boolean;
  };
}
