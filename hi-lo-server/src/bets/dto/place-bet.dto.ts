import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BetSide, BetType, DigitBetType } from '@prisma/client';

export class PlaceBetDto {
  @IsInt()
  roundId!: number;

  @IsOptional()
  @IsEnum(BetType)
  betType?: BetType;

  @IsOptional()
  @IsEnum(BetSide)
  side?: BetSide;

  @IsOptional()
  @IsEnum(DigitBetType)
  digitType?: DigitBetType;

  @IsOptional()
  @IsString()
  selection?: string;

  @IsNumber()
  @Min(0.00000001)
  amount!: number;
}
