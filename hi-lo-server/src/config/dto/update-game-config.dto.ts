import { IsInt, IsNumber, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateGameConfigDto {
  @IsInt()
  @Min(0)
  bettingDurationMs: number;

  @IsInt()
  @Min(0)
  resultDurationMs: number;

  @IsInt()
  @Min(0)
  resultDisplayDurationMs: number;

  @IsNumber()
  @Min(0)
  minBetAmount: number;

  @IsNumber()
  @Min(0)
  maxBetAmount: number;

  @IsNumber()
  @Min(0)
  payoutMultiplierUp: number;

  @IsNumber()
  @Min(0)
  payoutMultiplierDown: number;

  @IsInt()
  @Min(1)
  priceSnapshotInterval: number;

  @IsInt()
  @Min(1)
  bonusSlotChanceTotal: number;

  @IsObject()
  digitPayouts: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  digitBonusRatios?: Record<string, unknown>;
}
