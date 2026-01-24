import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryTransfersDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;
}

export interface TransferResponseItem {
  id: string;
  visibleId: string;
  merchantId: string;
  playerId: string;
  playerAccount: string | null;
  orderNo: string;
  type: number;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}
