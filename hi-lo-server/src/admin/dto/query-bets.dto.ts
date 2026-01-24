import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { BetResult, BetType } from '@prisma/client';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryBetsDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  betId?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  playerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roundId?: number;

  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

  @IsOptional()
  @IsEnum(BetResult)
  result?: BetResult;
}

export interface BetResponseItem {
  id: string;
  merchantId: string | null;
  playerId: string;
  playerAccount: string | null;
  roundId: number;
  betType: string;
  side: string | null;
  digitType: string | null;
  selection: string | null;
  odds: number;
  amount: number;
  result: string;
  payout: number;
  createdAt: string;
  updatedAt: string;
}
