import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';
import { DIGIT_PAYOUTS, DIGIT_SUM_RANGES } from '../game/digit-bet.constants';

@Controller('config')
export class GameConfigController {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  @Get('game')
  getGameConfig() {
    return {
      bettingDurationMs: this.configService.getOrThrow<number>(
        'game.bettingDurationMs',
        { infer: true },
      ),
      resultDurationMs: this.configService.getOrThrow<number>(
        'game.resultDurationMs',
        { infer: true },
      ),
      resultDisplayDurationMs: this.configService.getOrThrow<number>(
        'game.resultDisplayDurationMs',
        { infer: true },
      ),
      minBetAmount: this.configService.getOrThrow<number>('game.minBetAmount', {
        infer: true,
      }),
      maxBetAmount: this.configService.getOrThrow<number>('game.maxBetAmount', {
        infer: true,
      }),
      payoutMultiplierUp: this.configService.getOrThrow<number>(
        'game.payoutMultiplierUp',
        { infer: true },
      ),
      payoutMultiplierDown: this.configService.getOrThrow<number>(
        'game.payoutMultiplierDown',
        { infer: true },
      ),
      historyLimits: {
        player: this.configService.getOrThrow<number>('history.playerLimit', {
          infer: true,
        }),
        rounds: this.configService.getOrThrow<number>('history.roundLimit', {
          infer: true,
        }),
      },
      digitPayouts: {
        smallBigOddEven: DIGIT_PAYOUTS.smallBigOddEven,
        anyTriple: DIGIT_PAYOUTS.anyTriple,
        double: DIGIT_PAYOUTS.double,
        triple: DIGIT_PAYOUTS.triple,
        single: DIGIT_PAYOUTS.single,
        sum: DIGIT_PAYOUTS.sum,
        ranges: DIGIT_SUM_RANGES,
      },
    };
  }
}
