import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LaunchBetLimitRangeDto {
  @IsDefined()
  @IsNumber()
  @Min(0)
  minBetLimit: number;

  @IsDefined()
  @IsNumber()
  @Min(0)
  maxBetLimit: number;
}

export class LaunchBetLimitsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  bigSmall: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  oddEven: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  eachDouble: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  eachTripple: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  sum: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  single: LaunchBetLimitRangeDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitRangeDto)
  anyTripple: LaunchBetLimitRangeDto;
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

  @IsDefined()
  @ValidateNested()
  @Type(() => LaunchBetLimitsDto)
  betLimits: LaunchBetLimitsDto;

  @IsNumber()
  timestamp: number;

  @IsString()
  @IsNotEmpty()
  hash: string;
}

export class LaunchGameResponseData {
  url: string;
}
