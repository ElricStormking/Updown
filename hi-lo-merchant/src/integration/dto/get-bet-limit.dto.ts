import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { DigitBetAmountLimitsResponseData } from './bet-limit-rules.dto';

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
  digitBetAmountLimits: DigitBetAmountLimitsResponseData;
}
