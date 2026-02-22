import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class GetBetHistoryDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  startBetTime: string; // UTC datetime string

  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize: number;

  @IsNumber()
  @Min(1)
  pageNumber: number;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class BetHistoryItem {
  id: string;
  account: string;
  roundId: number;
  betType: string;
  side: string | null;
  digitType: string | null;
  selection: string | null;
  amount: number;
  odds: number;
  result: string;
  payout: number;
  betTime: string;
  lockedPrice: number | null;
  finalPrice: number | null;
  winningSide: string | null;
  digitResult: string | null;
  digitSum: number | null;
}

export class GetBetHistoryResponseData {
  bets: BetHistoryItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPageNumber: number;
}
