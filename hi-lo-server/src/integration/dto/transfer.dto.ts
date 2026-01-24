import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsNumber()
  type: number; // 0 = into game, 1 = out to merchant

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class TransferResponseData {
  balance: number;
}
