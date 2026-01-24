import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WalletTxType } from '@prisma/client';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryTransactionsDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsEnum(WalletTxType)
  type?: WalletTxType;
}

export interface TransactionResponseItem {
  id: string;
  merchantId: string | null;
  playerId: string;
  playerAccount: string | null;
  type: string;
  referenceId: string | null;
  balanceBefore: number;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}
