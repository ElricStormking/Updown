import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { DigitBetAmountLimitsDto } from './bet-limit-rules.dto';

export class LaunchGameDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBetAmount?: number;

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

export class LaunchGameResponseData {
  url: string;
}
