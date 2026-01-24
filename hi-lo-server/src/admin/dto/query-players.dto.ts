import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { PaginationQueryDto } from './pagination.dto';

export class QueryPlayersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class UpdatePlayerStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

export interface PlayerResponseItem {
  id: string;
  merchantId: string | null;
  account: string;
  merchantAccount: string | null;
  status: string;
  balance: number;
  currency: string;
  createdAt: string;
}
