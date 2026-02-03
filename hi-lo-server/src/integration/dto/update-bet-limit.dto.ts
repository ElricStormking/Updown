import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class UpdateBetLimitDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber()
  @Min(0)
  maxBetAmount: number;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class UpdateBetLimitResponseData {
  minBetAmount: number;
  maxBetAmount: number;
}
