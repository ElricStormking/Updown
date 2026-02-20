import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';
import { DIGIT_SUM_RANGES } from '../game/digit-bet.constants';
import { GameConfigService } from './game-config.service';
import { UpdateGameConfigDto } from './dto/update-game-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AdminContext } from '../auth/guards/admin.guard';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('config')
export class GameConfigController {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly gameConfigService: GameConfigService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Header(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate',
  )
  @Header('Pragma', 'no-cache')
  @Get('game')
  async getGameConfig(
    @Query('merchantId') merchantId?: string,
    @Req() request?: { user?: AuthUser },
  ) {
    const user = request?.user;
    const requestedMerchantId = merchantId?.trim() || null;
    const requesterMerchantId = user?.merchantId?.trim() || '';
    const isAdmin = user?.type === 'admin';
    const isSuperAdmin = isAdmin && requesterMerchantId === 'hotcoregm';

    let targetMerchantId: string | null = null;
    if (isSuperAdmin) {
      targetMerchantId = requestedMerchantId;
    } else {
      if (!requesterMerchantId) {
        throw new ForbiddenException('Account is not assigned to a merchant');
      }
      if (requestedMerchantId && requestedMerchantId !== requesterMerchantId) {
        throw new ForbiddenException('Cannot access other merchant configs');
      }
      targetMerchantId = requesterMerchantId;
    }

    const config =
      await this.gameConfigService.getActiveConfig(targetMerchantId);
    const runtimeVersion =
      await this.gameConfigService.getRuntimeConfigVersionTag();
    return this.buildResponse(
      {
        ...config,
        configVersion: runtimeVersion,
      },
      targetMerchantId,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('game')
  async updateGameConfig(
    @Body() dto: UpdateGameConfigDto,
    @Query('merchantId') merchantId?: string,
    @Req()
    request?: { adminContext?: AdminContext },
  ) {
    const adminContext = request?.adminContext;
    let targetMerchantId = merchantId?.trim() || null;

    if (adminContext && !adminContext.isSuperAdmin) {
      if (targetMerchantId && targetMerchantId !== adminContext.merchantId) {
        throw new ForbiddenException('Cannot update other merchant configs');
      }
      targetMerchantId = adminContext.merchantId;
      const current = await this.gameConfigService.getActiveConfig(
        targetMerchantId || null,
      );
      // Limited merchant admins can tune payout/bonus settings only in this phase.
      dto = {
        ...dto,
        bettingDurationMs: current.bettingDurationMs,
        resultDurationMs: current.resultDurationMs,
        resultDisplayDurationMs: current.resultDisplayDurationMs,
        priceSnapshotInterval: current.priceSnapshotInterval,
      };
    }

    const config = await this.gameConfigService.updateFromInput(
      dto,
      targetMerchantId,
    );
    const runtimeVersion =
      await this.gameConfigService.getRuntimeConfigVersionTag();
    return this.buildResponse(
      {
        ...config,
        configVersion: runtimeVersion,
      },
      targetMerchantId,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('game/merchants')
  async listMerchantConfigs(
    @Req()
    request?: {
      adminContext?: AdminContext;
    },
  ) {
    const adminContext = request?.adminContext;
    if (adminContext && !adminContext.isSuperAdmin) {
      throw new ForbiddenException('Merchant listing is restricted');
    }
    return this.gameConfigService.listMerchantConfigs();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('game/merchant/:merchantId')
  async deleteConfigForMerchant(
    @Param('merchantId') merchantId: string,
    @Req()
    request?: { adminContext?: AdminContext },
  ) {
    const adminContext = request?.adminContext;
    if (adminContext && !adminContext.isSuperAdmin) {
      throw new ForbiddenException('Delete config is restricted');
    }
    await this.gameConfigService.deleteConfigForMerchant(merchantId);
    return {
      success: true,
      message: `Config for merchant ${merchantId} deleted`,
    };
  }

  private buildResponse(
    config: {
      configVersion?: string;
      bettingDurationMs: number;
      resultDurationMs: number;
      resultDisplayDurationMs: number;
      minBetAmount: number;
      maxBetAmount: number;
      digitBetAmountLimits: {
        smallBig: { minBetAmount: number; maxBetAmount: number };
        oddEven: { minBetAmount: number; maxBetAmount: number };
        double: { minBetAmount: number; maxBetAmount: number };
        triple: { minBetAmount: number; maxBetAmount: number };
        sum: { minBetAmount: number; maxBetAmount: number };
        single: { minBetAmount: number; maxBetAmount: number };
        anyTriple: { minBetAmount: number; maxBetAmount: number };
      };
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
          {
            suggestWinPct: number;
            suggestWinPctDouble: number;
            suggestWinPctTriple: number;
            rtpFoolProofPct: number;
            totalCounts: number;
          }
        >;
      };
      digitBonusRatios: Record<string, { ratios: number[]; weights: number[] }>;
    },
    merchantId: string | null,
  ) {
    return {
      merchantId: merchantId ?? null,
      configVersion: config.configVersion ?? null,
      bettingDurationMs: config.bettingDurationMs,
      resultDurationMs: config.resultDurationMs,
      resultDisplayDurationMs: config.resultDisplayDurationMs,
      minBetAmount: config.minBetAmount,
      maxBetAmount: config.maxBetAmount,
      digitBetAmountLimits: config.digitBetAmountLimits,
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
