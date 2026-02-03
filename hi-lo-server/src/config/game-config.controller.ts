import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
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
  async getGameConfig(@Query('merchantId') merchantId?: string) {
    const config = await this.gameConfigService.getActiveConfig(merchantId || null);
    return this.buildResponse(config, merchantId || null);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('game')
  async updateGameConfig(
    @Body() dto: UpdateGameConfigDto,
    @Query('merchantId') merchantId?: string,
  ) {
    const config = await this.gameConfigService.updateFromInput(dto, merchantId || null);
    return this.buildResponse(config, merchantId || null);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('game/merchants')
  async listMerchantConfigs() {
    return this.gameConfigService.listMerchantConfigs();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('game/merchant/:merchantId')
  async deleteConfigForMerchant(@Param('merchantId') merchantId: string) {
    await this.gameConfigService.deleteConfigForMerchant(merchantId);
    return { success: true, message: `Config for merchant ${merchantId} deleted` };
  }

  private buildResponse(config: {
    configVersion?: string;
    bettingDurationMs: number;
    resultDurationMs: number;
    resultDisplayDurationMs: number;
    minBetAmount: number;
    maxBetAmount: number;
    tokenValues: number[];
    payoutMultiplierUp: number;
    payoutMultiplierDown: number;
    priceSnapshotInterval: number;
    bonusModeEnabled: boolean;
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
  }, merchantId: string | null) {
    return {
      merchantId: merchantId ?? null,
      configVersion: config.configVersion ?? null,
      bettingDurationMs: config.bettingDurationMs,
      resultDurationMs: config.resultDurationMs,
      resultDisplayDurationMs: config.resultDisplayDurationMs,
      minBetAmount: config.minBetAmount,
      maxBetAmount: config.maxBetAmount,
      tokenValues: config.tokenValues,
      payoutMultiplierUp: config.payoutMultiplierUp,
      payoutMultiplierDown: config.payoutMultiplierDown,
      priceSnapshotInterval: config.priceSnapshotInterval,
      bonusModeEnabled: config.bonusModeEnabled,
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
      digitBonus: {
        ...this.configService.getOrThrow('game.digitBonus', { infer: true }),
        enabled: config.bonusModeEnabled,
      },
    };
  }
}
