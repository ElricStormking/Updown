import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DigitBetAmountLimitsDto } from './bet-limit-rules.dto';

export class LaunchBetLimitsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  bigSmall?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oddEven?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  eachDouble?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  eachTripple?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sum?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  single?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  anyTripple?: number;
}

export class LaunchGameDto {
  @IsString()
  @IsNotEmpty()
  merchantId: string;

  @IsString()
  @IsNotEmpty()
  account: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.playerId !== undefined)
  @IsNotEmpty()
  playerId?: string;

  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.accessToken !== undefined)
  @IsNotEmpty()
  accessToken?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LaunchBetLimitsDto)
  betLimits?: LaunchBetLimitsDto;

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
