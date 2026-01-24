import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryPriceSnapshotsDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  roundId?: number;

  @IsOptional()
  @IsString()
  source?: string;
}

export interface PriceSnapshotResponseItem {
  id: string;
  timestamp: string;
  price: number;
  source: string;
  roundId: number | null;
}
