import { IsOptional, IsString } from 'class-validator';
import { DateRangeQueryDto } from './pagination.dto';

export class QueryPlayerLoginsDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @IsString()
  account?: string;
}

export interface PlayerLoginResponseItem {
  id: string;
  merchantId: string;
  playerId: string;
  playerAccount: string | null;
  loginTime: string;
}
