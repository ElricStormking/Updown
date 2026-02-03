import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class GetBetLimitDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class GetBetLimitResponseData {
  minBetAmount: number;
  maxBetAmount: number;
}
