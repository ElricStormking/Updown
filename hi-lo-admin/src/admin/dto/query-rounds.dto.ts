import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { RoundStatus } from '@prisma/client';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryRoundsDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roundId?: number;

  @IsOptional()
  @IsEnum(RoundStatus)
  status?: RoundStatus;
}

export interface RoundResponseItem {
  id: number;
  startTime: string;
  lockTime: string;
  endTime: string;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: string | null;
  digitResult: string | null;
  digitSum: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
