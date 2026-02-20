import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AllTransferOutDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @IsString()
  @IsNotEmpty()
  transferId: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class AllTransferOutResponseData {
  balance: number;
}
