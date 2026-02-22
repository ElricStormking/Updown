import { Type } from 'class-transformer';
import { IsNumber, Min, ValidateNested } from 'class-validator';

export class BetAmountLimitRuleDto {
  @IsNumber()
  @Min(0)
  minBetAmount: number;

  @IsNumber()
  @Min(0)
  maxBetAmount: number;
}

export class DigitBetAmountLimitsDto {
  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  smallBig: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  oddEven: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  double: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  triple: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  sum: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  single: BetAmountLimitRuleDto;

  @ValidateNested()
  @Type(() => BetAmountLimitRuleDto)
  anyTriple: BetAmountLimitRuleDto;
}

export class DigitBetAmountLimitsResponseData {
  smallBig: BetAmountLimitRuleDto;
  oddEven: BetAmountLimitRuleDto;
  double: BetAmountLimitRuleDto;
  triple: BetAmountLimitRuleDto;
  sum: BetAmountLimitRuleDto;
  single: BetAmountLimitRuleDto;
  anyTriple: BetAmountLimitRuleDto;
}
