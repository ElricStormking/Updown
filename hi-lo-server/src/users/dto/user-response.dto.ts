export class UserResponseDto {
  id!: string;
  email!: string;
  createdAt!: Date;
  updatedAt!: Date;
  wallet?: {
    id: string;
    balance: string;
    currency: string;
    updatedAt: Date;
  } | null;
}
