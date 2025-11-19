import { IsEnum, IsInt, IsNumber, Min } from 'class-validator';
import { BetSide } from '@prisma/client';

export class PlaceBetDto {
  @IsInt()
  roundId!: number;

  @IsEnum(BetSide)
  side!: BetSide;

  @IsNumber()
  @Min(0.00000001)
  amount!: number;
}
