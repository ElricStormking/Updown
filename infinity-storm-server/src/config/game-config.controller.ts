import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

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
    };
  }
}
