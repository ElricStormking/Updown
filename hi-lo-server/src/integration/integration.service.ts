import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Merchant, Prisma, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { GameConfigService } from '../config/game-config.service';
import {
  validateSignature,
  formatDateForSignature,
} from './utils/signature.utils';
import {
  IntegrationErrorCodes,
  IntegrationErrorMessages,
} from './utils/error-codes';
import { IntegrationResponseDto } from './dto/integration-response.dto';
import {
  TransferResponseData,
  GetBetHistoryResponseData,
  BetHistoryItem,
  GetTransferHistoryResponseData,
  TransferHistoryItem,
  LaunchGameResponseData,
  UpdateBetLimitResponseData,
  UpdateTokenValuesResponseData,
} from './dto';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gameConfigService: GameConfigService,
  ) {}

  async createAccount(
    merchant: Merchant,
    account: string,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<null>> {
    const params = [merchant.merchantId, account, timestamp.toString()];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        merchantId_merchantAccount: {
          merchantId: merchant.merchantId,
          merchantAccount: account,
        },
      },
    });

    if (existingUser) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.ACCOUNT_ALREADY_EXISTS,
        IntegrationErrorMessages[IntegrationErrorCodes.ACCOUNT_ALREADY_EXISTS],
      );
    }

    try {
      await this.prisma.user.create({
        data: {
          email: `${merchant.merchantId}_${account}@merchant.local`,
          password: '',
          merchantId: merchant.merchantId,
          merchantAccount: account,
          wallet: {
            create: {
              balance: new Prisma.Decimal(0),
              currency: 'USDT',
            },
          },
        },
      });

      return IntegrationResponseDto.success(null);
    } catch (error) {
      this.logger.error('Failed to create account', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async transfer(
    merchant: Merchant,
    account: string,
    orderNo: string,
    type: number,
    amount: number,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<TransferResponseData>> {
    const params = [
      merchant.merchantId,
      account,
      type.toString(),
      amount.toString(),
      timestamp.toString(),
    ];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (type !== 0 && type !== 1) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_TRANSFER_TYPE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_TRANSFER_TYPE],
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        merchantId_merchantAccount: {
          merchantId: merchant.merchantId,
          merchantAccount: account,
        },
      },
      include: { wallet: true },
    });

    if (!user) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.ACCOUNT_NOT_FOUND,
        IntegrationErrorMessages[IntegrationErrorCodes.ACCOUNT_NOT_FOUND],
      );
    }

    const existingTransfer = await this.prisma.transfer.findUnique({
      where: {
        merchantId_orderNo: {
          merchantId: merchant.merchantId,
          orderNo,
        },
      },
    });

    if (existingTransfer) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.DUPLICATE_ORDER_NUMBER,
        IntegrationErrorMessages[IntegrationErrorCodes.DUPLICATE_ORDER_NUMBER],
      );
    }

    try {
      const amountDecimal = new Prisma.Decimal(amount);
      const adjustAmount = type === 0 ? amountDecimal : amountDecimal.mul(-1);

      const txType =
        type === 0 ? WalletTxType.TRANSFER_IN : WalletTxType.TRANSFER_OUT;
      const result = await this.prisma.$transaction(async (tx) => {
        const visibleId = this.generateTransferId();
        const wallet = await this.walletService.adjustBalance(
          user.id,
          adjustAmount,
          {
            type: txType,
            merchantId: merchant.merchantId,
            referenceId: visibleId,
          },
          tx,
        );

        await tx.transfer.create({
          data: {
            visibleId,
            merchantId: merchant.merchantId,
            userId: user.id,
            orderNo,
            type,
            amount: amountDecimal,
            balanceAfter: wallet.balance,
          },
        });

        return wallet;
      });

      return IntegrationResponseDto.success({
        balance: Number(result.balance),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Insufficient balance')
      ) {
        return IntegrationResponseDto.error(
          IntegrationErrorCodes.INSUFFICIENT_BALANCE,
          IntegrationErrorMessages[IntegrationErrorCodes.INSUFFICIENT_BALANCE],
        );
      }
      this.logger.error('Failed to process transfer', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async getBetHistory(
    merchant: Merchant,
    startBetTime: string,
    pageSize: number,
    pageNumber: number,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<GetBetHistoryResponseData>> {
    const startDate = new Date(startBetTime);
    const formattedTime = formatDateForSignature(startDate);
    const params = [
      merchant.merchantId,
      formattedTime,
      pageSize.toString(),
      pageNumber.toString(),
      timestamp.toString(),
    ];

    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_PAGE_SIZE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_PAGE_SIZE],
      );
    }

    if (pageNumber < 1) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_PAGE_NUMBER,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_PAGE_NUMBER],
      );
    }

    try {
      const skip = (pageNumber - 1) * pageSize;

      const [bets, totalCount] = await Promise.all([
        this.prisma.bet.findMany({
          where: {
            merchantId: merchant.merchantId,
            createdAt: { gte: startDate },
          },
          include: {
            user: true,
            round: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        this.prisma.bet.count({
          where: {
            merchantId: merchant.merchantId,
            createdAt: { gte: startDate },
          },
        }),
      ]);

      const betItems: BetHistoryItem[] = bets.map((bet) => ({
        id: bet.id,
        account: bet.user.merchantAccount ?? '',
        roundId: bet.roundId,
        betType: bet.betType,
        side: bet.side,
        digitType: bet.digitType,
        selection: bet.selection,
        amount: Number(bet.amount),
        odds: Number(bet.odds),
        result: bet.result,
        payout: Number(bet.payout),
        betTime: bet.createdAt.toISOString(),
        lockedPrice: bet.round.lockedPrice
          ? Number(bet.round.lockedPrice)
          : null,
        finalPrice: bet.round.finalPrice ? Number(bet.round.finalPrice) : null,
        winningSide: bet.round.winningSide,
        digitResult: bet.round.digitResult,
        digitSum: bet.round.digitSum,
      }));

      return IntegrationResponseDto.success({
        bets: betItems,
        pageNumber,
        pageSize,
        totalCount,
        totalPageNumber: Math.ceil(totalCount / pageSize),
      });
    } catch (error) {
      this.logger.error('Failed to get bet history', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async getTransferHistory(
    merchant: Merchant,
    startTime: string,
    pageSize: number,
    pageNumber: number,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<GetTransferHistoryResponseData>> {
    const startDate = new Date(startTime);
    const formattedTime = formatDateForSignature(startDate);
    const params = [
      merchant.merchantId,
      formattedTime,
      pageSize.toString(),
      pageNumber.toString(),
      timestamp.toString(),
    ];

    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_PAGE_SIZE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_PAGE_SIZE],
      );
    }

    if (pageNumber < 1) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_PAGE_NUMBER,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_PAGE_NUMBER],
      );
    }

    try {
      const skip = (pageNumber - 1) * pageSize;

      const [transfers, totalCount] = await Promise.all([
        this.prisma.transfer.findMany({
          where: {
            merchantId: merchant.merchantId,
            createdAt: { gte: startDate },
          },
          include: { user: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        this.prisma.transfer.count({
          where: {
            merchantId: merchant.merchantId,
            createdAt: { gte: startDate },
          },
        }),
      ]);

      const transferItems: TransferHistoryItem[] = transfers.map((t) => ({
        id: t.visibleId,
        account: t.user.merchantAccount ?? '',
        orderNo: t.orderNo,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        createdAt: t.createdAt.toISOString(),
      }));

      return IntegrationResponseDto.success({
        transfers: transferItems,
        pageNumber,
        pageSize,
        totalCount,
        totalPageNumber: Math.ceil(totalCount / pageSize),
      });
    } catch (error) {
      this.logger.error('Failed to get transfer history', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async launchGame(
    merchant: Merchant,
    account: string,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<LaunchGameResponseData>> {
    const params = [merchant.merchantId, account, timestamp.toString()];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        merchantId_merchantAccount: {
          merchantId: merchant.merchantId,
          merchantAccount: account,
        },
      },
    });

    if (!user) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.ACCOUNT_NOT_FOUND,
        IntegrationErrorMessages[IntegrationErrorCodes.ACCOUNT_NOT_FOUND],
      );
    }

    try {
      const payload = {
        sub: user.id,
        account: user.merchantAccount,
        merchantId: merchant.merchantId,
      };

      const expiresIn =
        this.configService.get<string>('auth.jwtExpiresIn') ?? '1h';
      const secret =
        this.configService.get<string>('auth.jwtSecret') ?? 'change-me';

      const accessToken = await this.jwtService.signAsync(payload, {
        secret,
        expiresIn: expiresIn as any,
      });

      const gameUrl =
        this.configService.get<string>('integration.gameUrl') ??
        'https://game.example.com';

      return IntegrationResponseDto.success({
        url: `${gameUrl}?accessToken=${accessToken}`,
      });
    } catch (error) {
      this.logger.error('Failed to launch game', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async updateBetLimit(
    merchant: Merchant,
    maxBetAmount: number,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<UpdateBetLimitResponseData>> {
    const maxBetAmountText = String(maxBetAmount ?? '');
    const params = [
      merchant.merchantId,
      maxBetAmountText,
      timestamp.toString(),
    ];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (!Number.isFinite(maxBetAmount) || maxBetAmount < 0) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT],
      );
    }

    try {
      const current = await this.gameConfigService.getActiveConfig(
        merchant.merchantId,
      );
      const updated = await this.gameConfigService.updateConfig(
        { ...current, maxBetAmount },
        merchant.merchantId,
      );
      return IntegrationResponseDto.success({
        minBetAmount: updated.minBetAmount,
        maxBetAmount: updated.maxBetAmount,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('maxBetAmount')) {
        return IntegrationResponseDto.error(
          IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
          IntegrationErrorMessages[
            IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT
          ],
        );
      }
      this.logger.error('Failed to update bet limit', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async updateTokenValues(
    merchant: Merchant,
    tokenValues: number[],
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<UpdateTokenValuesResponseData>> {
    const tokenValuesSignature = Array.isArray(tokenValues)
      ? tokenValues.join(',')
      : '';
    const params = [
      merchant.merchantId,
      tokenValuesSignature,
      timestamp.toString(),
    ];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (
      !Array.isArray(tokenValues) ||
      tokenValues.length !== 7 ||
      tokenValues.some((value) => !Number.isFinite(value) || value <= 0)
    ) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_TOKEN_VALUES,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_TOKEN_VALUES],
      );
    }

    try {
      const current = await this.gameConfigService.getActiveConfig(
        merchant.merchantId,
      );
      const updated = await this.gameConfigService.updateConfig(
        { ...current, tokenValues },
        merchant.merchantId,
      );
      return IntegrationResponseDto.success({
        tokenValues: updated.tokenValues,
      });
    } catch (error) {
      this.logger.error('Failed to update token values', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  private generateTransferId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `TF${timestamp}${random}`.toUpperCase();
  }
}
