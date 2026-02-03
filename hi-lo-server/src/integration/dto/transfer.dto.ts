import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @ValidateIf((o) => !o.orderNo)
  @IsString()
  @IsNotEmpty()
  transferId: string;

  @ValidateIf((o) => !o.transferId)
  @IsString()
  @IsNotEmpty()
  orderNo?: string;

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
