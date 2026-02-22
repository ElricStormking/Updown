import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class GetTransferHistoryDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  startTime: string; // UTC datetime string

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

export class TransferHistoryItem {
  id: string;
  account: string;
  transferId: string;
  type: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export class GetTransferHistoryResponseData {
  transfers: TransferHistoryItem[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPageNumber: number;
}
