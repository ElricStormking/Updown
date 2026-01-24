import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';
import { DIGIT_SUM_RANGES } from '../game/digit-bet.constants';
import { GameConfigService } from './game-config.service';
import { UpdateGameConfigDto } from './dto/update-game-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('config')
export class GameConfigController {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly gameConfigService: GameConfigService,
  ) {}

  @Get('game')
  async getGameConfig() {
    const config = await this.gameConfigService.getActiveConfig();
    return this.buildResponse(config);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('game')
  async updateGameConfig(@Body() dto: UpdateGameConfigDto) {
    const config = await this.gameConfigService.updateFromInput(dto);
    return this.buildResponse(config);
  }

  private buildResponse(config: {
    configVersion?: string;
    bettingDurationMs: number;
    resultDurationMs: number;
    resultDisplayDurationMs: number;
    minBetAmount: number;
    maxBetAmount: number;
    payoutMultiplierUp: number;
    payoutMultiplierDown: number;
    priceSnapshotInterval: number;
    bonusSlotChanceTotal: number;
    digitPayouts: {
      smallBigOddEven: number;
      anyTriple: number;
      double: number;
      triple: number;
      single: {
        single: number;
        double: number;
        triple: number;
      };
      sum: Record<number, number>;
      bySlot: Record<string, number>;
      bySlotMeta: Record<
        string,
        { suggestWinPct: number; rtpFoolProofPct: number; totalCounts: number }
      >;
    };
    digitBonusRatios: Record<string, { ratios: number[]; weights: number[] }>;
  }) {
    return {
      configVersion: config.configVersion ?? null,
      bettingDurationMs: config.bettingDurationMs,
      resultDurationMs: config.resultDurationMs,
      resultDisplayDurationMs: config.resultDisplayDurationMs,
      minBetAmount: config.minBetAmount,
      maxBetAmount: config.maxBetAmount,
      payoutMultiplierUp: config.payoutMultiplierUp,
      payoutMultiplierDown: config.payoutMultiplierDown,
      priceSnapshotInterval: config.priceSnapshotInterval,
      bonusSlotChanceTotal: config.bonusSlotChanceTotal,
      historyLimits: {
        player: this.configService.getOrThrow<number>('history.playerLimit', {
          infer: true,
        }),
        rounds: this.configService.getOrThrow<number>('history.roundLimit', {
          infer: true,
        }),
      },
      digitPayouts: {
        smallBigOddEven: config.digitPayouts.smallBigOddEven,
        anyTriple: config.digitPayouts.anyTriple,
        double: config.digitPayouts.double,
        triple: config.digitPayouts.triple,
        single: config.digitPayouts.single,
        sum: config.digitPayouts.sum,
        bySlot: config.digitPayouts.bySlot,
        bySlotMeta: config.digitPayouts.bySlotMeta,
        ranges: DIGIT_SUM_RANGES,
      },
      digitBonusRatios: config.digitBonusRatios,
      digitBonus: this.configService.getOrThrow('game.digitBonus', {
        infer: true,
      }),
    };
  }
}
