import type { UserWithWallet } from '../../users/users.service';

export interface AuthResponseDto {
  accessToken: string;
  // Public shape returned by UsersService.toPublic (password stripped)
  user: Omit<UserWithWallet, 'password'>;
}
