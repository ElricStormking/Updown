import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Merchant, Prisma, UserStatus, WalletTxType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { GameConfigService } from '../config/game-config.service';
import type {
  BetAmountLimit,
  DigitBetAmountLimits,
} from '../config/game-config.defaults';
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
  AllTransferOutResponseData,
  GetBetHistoryResponseData,
  BetHistoryItem,
  GetTransferHistoryResponseData,
  TransferHistoryItem,
  GetBetLimitResponseData,
  GetTokenValuesResponseData,
  LaunchGameResponseData,
  UpdateBetLimitResponseData,
  UpdateTokenValuesResponseData,
  DigitBetAmountLimitsDto,
  LaunchBetLimitsDto,
} from './dto';
import { LaunchSessionService } from './launch-session.service';

const DIGIT_BET_LIMIT_RULE_KEYS = [
  'smallBig',
  'oddEven',
  'double',
  'triple',
  'sum',
  'single',
  'anyTriple',
] as const satisfies ReadonlyArray<keyof DigitBetAmountLimits>;

const LAUNCH_BET_LIMIT_RULE_KEY_MAP = {
  bigSmall: 'smallBig',
  oddEven: 'oddEven',
  eachDouble: 'double',
  eachTripple: 'triple',
  sum: 'sum',
  single: 'single',
  anyTripple: 'anyTriple',
} as const satisfies Record<
  keyof LaunchBetLimitsDto,
  keyof DigitBetAmountLimits
>;

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gameConfigService: GameConfigService,
    private readonly launchSessionService: LaunchSessionService,
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
    transferId: string,
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
          orderNo: transferId,
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
            orderNo: transferId,
            type,
            amount: amountDecimal,
            balanceBefore: wallet.balance.sub(adjustAmount),
            balanceAfter: wallet.balance,
          },
        });

        return wallet;
      });
      if (type === 1) {
        await this.launchSessionService.closeActiveSessionsByAccount(
          merchant.merchantId,
          account,
        );
      }

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

  async allTransferOut(
    merchant: Merchant,
    account: string,
    transferId: string,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<AllTransferOutResponseData>> {
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

    const existingTransfer = await this.prisma.transfer.findUnique({
      where: {
        merchantId_orderNo: {
          merchantId: merchant.merchantId,
          orderNo: transferId,
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
      const result = await this.prisma.$transaction(async (tx) => {
        const walletBefore = await this.walletService.getOrCreateWallet(
          user.id,
          tx,
        );
        const amountDecimal = new Prisma.Decimal(walletBefore.balance);
        const adjustAmount = amountDecimal.mul(-1);
        const visibleId = this.generateTransferId();
        const walletAfter = await this.walletService.adjustBalance(
          user.id,
          adjustAmount,
          {
            type: WalletTxType.TRANSFER_OUT,
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
            orderNo: transferId,
            type: 1,
            amount: amountDecimal,
            balanceBefore: walletBefore.balance,
            balanceAfter: walletAfter.balance,
          },
        });

        return walletAfter;
      });

      await this.launchSessionService.closeActiveSessionsByAccount(
        merchant.merchantId,
        account,
      );

      return IntegrationResponseDto.success({
        balance: Number(result.balance),
      });
    } catch (error) {
      this.logger.error('Failed to process all-transfer-out', error);
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
        transferId: t.orderNo,
        type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
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
    playerId: string | undefined,
    merchantAccessToken: string | undefined,
    betLimits: LaunchBetLimitsDto | undefined,
    minBetAmount: number | undefined,
    maxBetAmount: number | undefined,
    digitBetAmountLimits: DigitBetAmountLimitsDto | undefined,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<LaunchGameResponseData>> {
    const hasLegacyBetLimitOverrides =
      minBetAmount !== undefined ||
      maxBetAmount !== undefined ||
      digitBetAmountLimits !== undefined;
    const signatureParams = hasLegacyBetLimitOverrides
      ? [
          merchant.merchantId,
          account,
          this.stringifyOptionalNumber(minBetAmount),
          this.stringifyOptionalNumber(maxBetAmount),
          this.serializeDigitBetAmountLimitsForSignature(digitBetAmountLimits),
          timestamp.toString(),
        ]
      : [merchant.merchantId, account, timestamp.toString()];

    if (!validateSignature(signatureParams, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        merchantId: merchant.merchantId,
        merchantAccount: account,
      },
    });

    if (!user) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.ACCOUNT_NOT_FOUND,
        IntegrationErrorMessages[IntegrationErrorCodes.ACCOUNT_NOT_FOUND],
      );
    }
    if (user.status === UserStatus.DISABLED) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.ACCOUNT_DISABLED,
        IntegrationErrorMessages[IntegrationErrorCodes.ACCOUNT_DISABLED],
      );
    }

    try {
      if (hasLegacyBetLimitOverrides) {
        const current = await this.gameConfigService.getActiveConfig(
          merchant.merchantId,
        );
        const nextMinBetAmount = minBetAmount ?? current.minBetAmount;
        const nextMaxBetAmount = maxBetAmount ?? current.maxBetAmount;

        if (
          !Number.isFinite(nextMinBetAmount) ||
          !Number.isFinite(nextMaxBetAmount) ||
          nextMinBetAmount < 0 ||
          nextMaxBetAmount < 0 ||
          nextMaxBetAmount < nextMinBetAmount
        ) {
          return IntegrationResponseDto.error(
            IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
            IntegrationErrorMessages[
              IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT
            ],
          );
        }

        const normalizedLimits =
          digitBetAmountLimits !== undefined
            ? this.mergeDigitBetAmountLimits(
                digitBetAmountLimits,
                current.digitBetAmountLimits,
              )
            : this.buildUniformDigitBetAmountLimits(
                nextMinBetAmount,
                nextMaxBetAmount,
              );

        await this.gameConfigService.updateConfig(
          {
            ...current,
            minBetAmount: nextMinBetAmount,
            maxBetAmount: nextMaxBetAmount,
            digitBetAmountLimits: normalizedLimits,
          },
          merchant.merchantId,
        );
      } else if (betLimits && this.hasAnyLaunchBetLimits(betLimits)) {
        const current = await this.gameConfigService.getActiveConfig(
          merchant.merchantId,
        );
        const mappedLimits = this.applyLaunchBetLimits(
          current.digitBetAmountLimits,
          betLimits,
        );
        const mappedMaxBetAmount = this.resolveMaxBetAmount(mappedLimits);
        if (mappedMaxBetAmount < current.minBetAmount) {
          return IntegrationResponseDto.error(
            IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
            IntegrationErrorMessages[
              IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT
            ],
          );
        }

        await this.gameConfigService.updateConfig(
          {
            ...current,
            maxBetAmount: mappedMaxBetAmount,
            digitBetAmountLimits: mappedLimits,
          },
          merchant.merchantId,
        );
      }

      let launchSessionId: string | undefined;
      let launchMode: 'legacy' | 'callback' = 'legacy';

      if (merchant.callbackEnabled) {
        const normalizedPlayerId = playerId?.trim() ?? '';
        const normalizedMerchantAccessToken = merchantAccessToken?.trim() ?? '';
        if (!normalizedPlayerId || !normalizedMerchantAccessToken) {
          return IntegrationResponseDto.error(
            IntegrationErrorCodes.CALLBACK_FIELDS_REQUIRED,
            IntegrationErrorMessages[
              IntegrationErrorCodes.CALLBACK_FIELDS_REQUIRED
            ],
          );
        }
        if (
          !merchant.loginPlayerCallbackUrl ||
          !merchant.updateBalanceCallbackUrl
        ) {
          return IntegrationResponseDto.error(
            IntegrationErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED,
            IntegrationErrorMessages[
              IntegrationErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED
            ],
          );
        }

        const launchSession =
          await this.launchSessionService.createOrReplaceActiveSession({
            merchantId: merchant.merchantId,
            userId: user.id,
            account,
            playerId: normalizedPlayerId,
            merchantAccessToken: normalizedMerchantAccessToken,
            currency: merchant.currency,
          });
        launchSessionId = launchSession.id;
        launchMode = 'callback';
      }

      const payload = {
        sub: user.id,
        account: user.merchantAccount ?? account,
        merchantId: merchant.merchantId,
        launchSessionId,
        launchMode,
        type: 'user' as const,
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
      const separator = gameUrl.includes('?') ? '&' : '?';
      const query = `accessToken=${encodeURIComponent(accessToken)}&merchantId=${encodeURIComponent(merchant.merchantId)}`;

      return IntegrationResponseDto.success({
        url: `${gameUrl}${separator}${query}`,
      });
    } catch (error) {
      if (this.isBetLimitValidationError(error)) {
        return IntegrationResponseDto.error(
          IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
          IntegrationErrorMessages[
            IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT
          ],
        );
      }
      this.logger.error('Failed to launch game', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async getBetLimit(
    merchant: Merchant,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<GetBetLimitResponseData>> {
    const params = [merchant.merchantId, timestamp.toString()];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    try {
      const current = await this.gameConfigService.getActiveConfig(
        merchant.merchantId,
      );
      return IntegrationResponseDto.success({
        minBetAmount: current.minBetAmount,
        maxBetAmount: current.maxBetAmount,
        digitBetAmountLimits: this.cloneDigitBetAmountLimits(
          current.digitBetAmountLimits,
        ),
      });
    } catch (error) {
      this.logger.error('Failed to get bet limit', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async setBetLimit(
    merchant: Merchant,
    minBetAmount: number,
    maxBetAmount: number,
    digitBetAmountLimits: DigitBetAmountLimitsDto | undefined,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<UpdateBetLimitResponseData>> {
    const legacyParams = [
      merchant.merchantId,
      String(minBetAmount ?? ''),
      String(maxBetAmount ?? ''),
      timestamp.toString(),
    ];
    const extendedParams = [
      merchant.merchantId,
      String(minBetAmount ?? ''),
      String(maxBetAmount ?? ''),
      this.serializeDigitBetAmountLimitsForSignature(digitBetAmountLimits),
      timestamp.toString(),
    ];
    const validSignature =
      digitBetAmountLimits !== undefined
        ? validateSignature(extendedParams, merchant.hashKey, hash)
        : validateSignature(legacyParams, merchant.hashKey, hash) ||
          validateSignature(extendedParams, merchant.hashKey, hash);

    if (!validSignature) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    if (
      !Number.isFinite(minBetAmount) ||
      !Number.isFinite(maxBetAmount) ||
      minBetAmount < 0 ||
      maxBetAmount < 0 ||
      maxBetAmount < minBetAmount
    ) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT,
        IntegrationErrorMessages[
          IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT
        ],
      );
    }

    try {
      const current = await this.gameConfigService.getActiveConfig(
        merchant.merchantId,
      );
      const normalizedLimits =
        digitBetAmountLimits !== undefined
          ? this.mergeDigitBetAmountLimits(
              digitBetAmountLimits,
              current.digitBetAmountLimits,
            )
          : this.buildUniformDigitBetAmountLimits(minBetAmount, maxBetAmount);

      const updated = await this.gameConfigService.updateConfig(
        {
          ...current,
          minBetAmount,
          maxBetAmount,
          digitBetAmountLimits: normalizedLimits,
        },
        merchant.merchantId,
      );
      return IntegrationResponseDto.success({
        minBetAmount: updated.minBetAmount,
        maxBetAmount: updated.maxBetAmount,
        digitBetAmountLimits: this.cloneDigitBetAmountLimits(
          updated.digitBetAmountLimits,
        ),
      });
    } catch (error) {
      if (this.isBetLimitValidationError(error)) {
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

  private stringifyOptionalNumber(value: number | undefined): string {
    if (value === undefined) {
      return '';
    }
    return String(value);
  }

  private hasAnyLaunchBetLimits(betLimits: LaunchBetLimitsDto): boolean {
    return (
      Object.keys(LAUNCH_BET_LIMIT_RULE_KEY_MAP) as Array<
        keyof LaunchBetLimitsDto
      >
    ).some((key) => {
      const value = betLimits[key];
      return value !== undefined;
    });
  }

  private applyLaunchBetLimits(
    source: DigitBetAmountLimits,
    betLimits: LaunchBetLimitsDto,
  ): DigitBetAmountLimits {
    const next = this.cloneDigitBetAmountLimits(source);

    for (const [launchKey, digitRuleKey] of Object.entries(
      LAUNCH_BET_LIMIT_RULE_KEY_MAP,
    ) as Array<[keyof LaunchBetLimitsDto, keyof DigitBetAmountLimits]>) {
      const raw = betLimits[launchKey];
      if (raw === undefined) {
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Invalid launch betLimits');
      }
      next[digitRuleKey] = {
        minBetAmount: source[digitRuleKey].minBetAmount,
        maxBetAmount: Math.max(source[digitRuleKey].minBetAmount, value),
      };
    }

    return next;
  }

  private resolveMaxBetAmount(limits: DigitBetAmountLimits): number {
    let maxBetAmount = 0;
    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      maxBetAmount = Math.max(maxBetAmount, limits[key].maxBetAmount);
    }
    return maxBetAmount;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private serializeDigitBetAmountLimitsForSignature(
    digitBetAmountLimits: DigitBetAmountLimitsDto | undefined,
  ): string {
    if (!digitBetAmountLimits) {
      return '';
    }

    return DIGIT_BET_LIMIT_RULE_KEYS.map((key) => {
      const entry = this.isRecord(digitBetAmountLimits[key])
        ? (digitBetAmountLimits[key] as Record<string, unknown>)
        : null;
      const minBetAmount =
        entry?.minBetAmount === undefined ? '' : String(entry.minBetAmount);
      const maxBetAmount =
        entry?.maxBetAmount === undefined ? '' : String(entry.maxBetAmount);
      return `${key}:${minBetAmount},${maxBetAmount}`;
    }).join('|');
  }

  private buildUniformDigitBetAmountLimits(
    minBetAmount: number,
    maxBetAmount: number,
  ): DigitBetAmountLimits {
    return {
      smallBig: { minBetAmount, maxBetAmount },
      oddEven: { minBetAmount, maxBetAmount },
      double: { minBetAmount, maxBetAmount },
      triple: { minBetAmount, maxBetAmount },
      sum: { minBetAmount, maxBetAmount },
      single: { minBetAmount, maxBetAmount },
      anyTriple: { minBetAmount, maxBetAmount },
    };
  }

  private mergeDigitBetAmountLimits(
    digitBetAmountLimits: DigitBetAmountLimitsDto,
    fallback: DigitBetAmountLimits,
  ): DigitBetAmountLimits {
    const result = {} as DigitBetAmountLimits;

    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      const fallbackEntry = fallback[key];
      result[key] = this.normalizeBetAmountLimitEntry(
        digitBetAmountLimits[key],
        fallbackEntry,
      );
    }

    return result;
  }

  private normalizeBetAmountLimitEntry(
    raw: unknown,
    fallback: BetAmountLimit,
  ): BetAmountLimit {
    if (!this.isRecord(raw)) {
      return { ...fallback };
    }
    return {
      minBetAmount:
        raw.minBetAmount === undefined
          ? fallback.minBetAmount
          : Number(raw.minBetAmount),
      maxBetAmount:
        raw.maxBetAmount === undefined
          ? fallback.maxBetAmount
          : Number(raw.maxBetAmount),
    };
  }

  private cloneDigitBetAmountLimits(
    source: DigitBetAmountLimits,
  ): DigitBetAmountLimits {
    const result = {} as DigitBetAmountLimits;
    for (const key of DIGIT_BET_LIMIT_RULE_KEYS) {
      result[key] = {
        minBetAmount: source[key].minBetAmount,
        maxBetAmount: source[key].maxBetAmount,
      };
    }
    return result;
  }

  private isBetLimitValidationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    const message = error.message.toLowerCase();
    return (
      message.includes('minbetamount') ||
      message.includes('maxbetamount') ||
      message.includes('digitbetamountlimits') ||
      message.includes('launch betlimits')
    );
  }

  async getTokenValues(
    merchant: Merchant,
    timestamp: number,
    hash: string,
  ): Promise<IntegrationResponseDto<GetTokenValuesResponseData>> {
    const params = [merchant.merchantId, timestamp.toString()];
    if (!validateSignature(params, merchant.hashKey, hash)) {
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INVALID_SIGNATURE,
        IntegrationErrorMessages[IntegrationErrorCodes.INVALID_SIGNATURE],
      );
    }

    try {
      const current = await this.gameConfigService.getActiveConfig(
        merchant.merchantId,
      );
      return IntegrationResponseDto.success({
        tokenValues: current.tokenValues,
      });
    } catch (error) {
      this.logger.error('Failed to get token values', error);
      return IntegrationResponseDto.error(
        IntegrationErrorCodes.INTERNAL_ERROR,
        IntegrationErrorMessages[IntegrationErrorCodes.INTERNAL_ERROR],
      );
    }
  }

  async setTokenValues(
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
      const minTokenValue = Math.min(...tokenValues);
      if (current.minBetAmount > minTokenValue) {
        return IntegrationResponseDto.error(
          IntegrationErrorCodes.INVALID_TOKEN_VALUES,
          'Lowest token value must be >= minBetAmount',
        );
      }
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
