import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DigitBetAmountLimitsDto,
  DigitBetAmountLimitsResponseData,
} from './bet-limit-rules.dto';

export class UpdateBetLimitDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsNumber()
  @Min(0)
  minBetAmount: number;

  @IsNumber()
  @Min(0)
  maxBetAmount: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DigitBetAmountLimitsDto)
  digitBetAmountLimits?: DigitBetAmountLimitsDto;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class UpdateBetLimitResponseData {
  minBetAmount: number;
  maxBetAmount: number;
  digitBetAmountLimits: DigitBetAmountLimitsResponseData;
}
