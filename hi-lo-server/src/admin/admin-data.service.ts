import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryRoundsDto,
  RoundResponseItem,
  QueryBetsDto,
  BetResponseItem,
  QueryPlayersDto,
  PlayerResponseItem,
  QueryTransfersDto,
  TransferResponseItem,
  QueryTransactionsDto,
  TransactionResponseItem,
  QueryMerchantsDto,
  CreateMerchantDto,
  UpdateMerchantDto,
  MerchantResponseItem,
  QueryPriceSnapshotsDto,
  PriceSnapshotResponseItem,
  QueryPlayerLoginsDto,
  PlayerLoginResponseItem,
} from './dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseDateOnly = (value?: string) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Invalid date format (use YYYY-MM-DD)');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid date value');
  }
  return date;
};

const maskHashKey = (hashKey: string) => {
  if (hashKey.length <= 8) return '****';
  return hashKey.slice(0, 4) + '****' + hashKey.slice(-4);
};

@Injectable()
export class AdminDataService {
  constructor(private readonly prisma: PrismaService) {}

  // Rounds
  async queryRounds(dto: QueryRoundsDto) {
    const { page = 0, limit = 20, start, end, roundId, status } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.RoundWhereInput = {};
    if (roundId !== undefined) where.id = roundId;
    if (status) where.status = status;
    if (startDate || endExclusive) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endExclusive) where.createdAt.lt = endExclusive;
    }

    const skip = page * limit;
    const take = limit + 1;

    const rounds = await this.prisma.round.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take,
    });

    const hasNext = rounds.length > limit;
    const items: RoundResponseItem[] = rounds.slice(0, limit).map((r) => ({
      id: r.id,
      startTime: r.startTime.toISOString(),
      lockTime: r.lockTime.toISOString(),
      endTime: r.endTime.toISOString(),
      lockedPrice: r.lockedPrice ? Number(r.lockedPrice) : null,
      finalPrice: r.finalPrice ? Number(r.finalPrice) : null,
      winningSide: r.winningSide,
      digitResult: r.digitResult,
      digitSum: r.digitSum,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { page, limit, hasNext, items };
  }

  // Bets
  async queryBets(dto: QueryBetsDto, merchantScope?: string) {
    const {
      page = 0,
      limit = 20,
      start,
      end,
      betId,
      merchantId,
      playerId,
      roundId,
      betType,
      result,
    } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.BetWhereInput = {};
    if (betId) where.id = betId;
    if (merchantScope) where.merchantId = merchantScope;
    else if (merchantId) where.merchantId = merchantId;
    if (playerId) where.userId = playerId;
    if (roundId !== undefined) where.roundId = roundId;
    if (betType) where.betType = betType;
    if (result) where.result = result;
    if (startDate || endExclusive) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endExclusive) where.createdAt.lt = endExclusive;
    }

    const skip = page * limit;
    const take = limit + 1;

    const bets = await this.prisma.bet.findMany({
      where,
      include: { user: { select: { email: true, merchantAccount: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = bets.length > limit;
    const items: BetResponseItem[] = bets.slice(0, limit).map((b) => ({
      id: b.id,
      merchantId: b.merchantId,
      playerId: b.userId,
      playerAccount: b.user.merchantAccount || b.user.email,
      roundId: b.roundId,
      betType: b.betType,
      side: b.side,
      digitType: b.digitType,
      selection: b.selection,
      odds: Number(b.odds),
      amount: Number(b.amount),
      result: b.result,
      payout: Number(b.payout),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    }));

    return { page, limit, hasNext, items };
  }

  // Players
  async queryPlayers(dto: QueryPlayersDto, merchantScope?: string) {
    const { page = 0, limit = 20, merchantId, account, status } = dto;

    const where: Prisma.UserWhereInput = {};
    if (merchantScope) where.merchantId = merchantScope;
    else if (merchantId) where.merchantId = merchantId;
    if (account) {
      where.OR = [
        { email: { contains: account, mode: 'insensitive' } },
        { merchantAccount: { contains: account, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const skip = page * limit;
    const take = limit + 1;

    const users = await this.prisma.user.findMany({
      where,
      include: { wallet: { select: { balance: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = users.length > limit;
    const items: PlayerResponseItem[] = users.slice(0, limit).map((u) => ({
      id: u.id,
      merchantId: u.merchantId,
      account: u.email,
      merchantAccount: u.merchantAccount,
      status: u.status,
      balance: u.wallet ? Number(u.wallet.balance) : 0,
      currency: u.wallet?.currency || 'USDT',
      createdAt: u.createdAt.toISOString(),
    }));

    return { page, limit, hasNext, items };
  }

  async updatePlayerStatus(
    playerId: string,
    status: UserStatus,
    merchantScope?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: playerId } });
    if (!user || (merchantScope && user.merchantId !== merchantScope)) {
      throw new NotFoundException('Player not found');
    }
    const updated = await this.prisma.user.update({
      where: { id: playerId },
      data: { status },
      include: { wallet: { select: { balance: true, currency: true } } },
    });
    return {
      id: updated.id,
      merchantId: updated.merchantId,
      account: updated.email,
      merchantAccount: updated.merchantAccount,
      status: updated.status,
      balance: updated.wallet ? Number(updated.wallet.balance) : 0,
      currency: updated.wallet?.currency || 'USDT',
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // Transfers
  async queryTransfers(dto: QueryTransfersDto, merchantScope?: string) {
    const { page = 0, limit = 20, start, end, merchantId, account, type } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.TransferWhereInput = {};
    if (merchantScope) where.merchantId = merchantScope;
    else if (merchantId) where.merchantId = merchantId;
    if (type !== undefined) where.type = type;
    if (startDate || endExclusive) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endExclusive) where.createdAt.lt = endExclusive;
    }
    if (account) {
      where.user = {
        OR: [
          { email: { contains: account, mode: 'insensitive' } },
          { merchantAccount: { contains: account, mode: 'insensitive' } },
        ],
      };
    }

    const skip = page * limit;
    const take = limit + 1;

    const transfers = await this.prisma.transfer.findMany({
      where,
      include: { user: { select: { email: true, merchantAccount: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = transfers.length > limit;
    const items: TransferResponseItem[] = transfers
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        visibleId: t.visibleId,
        merchantId: t.merchantId,
        playerId: t.userId,
        playerAccount: t.user.merchantAccount || t.user.email,
        orderNo: t.orderNo,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        createdAt: t.createdAt.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }

  // Wallet Transactions
  async queryTransactions(dto: QueryTransactionsDto, merchantScope?: string) {
    const { page = 0, limit = 20, start, end, merchantId, account, type } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.WalletTransactionWhereInput = {};
    if (merchantScope) where.merchantId = merchantScope;
    else if (merchantId) where.merchantId = merchantId;
    if (type) where.type = type;
    if (startDate || endExclusive) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endExclusive) where.createdAt.lt = endExclusive;
    }
    if (account) {
      where.user = {
        OR: [
          { email: { contains: account, mode: 'insensitive' } },
          { merchantAccount: { contains: account, mode: 'insensitive' } },
        ],
      };
    }

    const skip = page * limit;
    const take = limit + 1;

    const transactions = await this.prisma.walletTransaction.findMany({
      where,
      include: { user: { select: { email: true, merchantAccount: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = transactions.length > limit;
    const items: TransactionResponseItem[] = transactions
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        merchantId: t.merchantId,
        playerId: t.userId,
        playerAccount: t.user.merchantAccount || t.user.email,
        type: t.type,
        referenceId: t.referenceId,
        balanceBefore: Number(t.balanceBefore),
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        createdAt: t.createdAt.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }

  // Merchants
  async queryMerchants(dto: QueryMerchantsDto, merchantScope?: string) {
    const { page = 0, limit = 20, merchantId, name, isActive } = dto;

    const where: Prisma.MerchantWhereInput = {};
    if (merchantScope) {
      where.merchantId = merchantScope;
    } else if (merchantId)
      where.merchantId = { contains: merchantId, mode: 'insensitive' };
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive;

    const skip = page * limit;
    const take = limit + 1;

    const merchants = await this.prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    const hasNext = merchants.length > limit;
    const items: MerchantResponseItem[] = merchants
      .slice(0, limit)
      .map((m) => ({
        id: m.id,
        merchantId: m.merchantId,
        name: m.name,
        hashKeyMasked: maskHashKey(m.hashKey),
        isActive: m.isActive,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }

  async createMerchant(dto: CreateMerchantDto) {
    const existing = await this.prisma.merchant.findUnique({
      where: { merchantId: dto.merchantId },
    });
    if (existing) {
      throw new BadRequestException('Merchant ID already exists');
    }
    const merchant = await this.prisma.merchant.create({
      data: {
        merchantId: dto.merchantId,
        name: dto.name,
        hashKey: dto.hashKey,
        isActive: dto.isActive ?? true,
      },
    });
    return {
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      hashKeyMasked: maskHashKey(merchant.hashKey),
      isActive: merchant.isActive,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),
    };
  }

  async updateMerchant(id: string, dto: UpdateMerchantDto, merchantScope?: string) {
    const existing = await this.prisma.merchant.findUnique({ where: { id } });
    if (!existing || (merchantScope && existing.merchantId !== merchantScope)) {
      throw new NotFoundException('Merchant not found');
    }
    const data: Prisma.MerchantUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.hashKey !== undefined) data.hashKey = dto.hashKey;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const merchant = await this.prisma.merchant.update({
      where: { id },
      data,
    });
    return {
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      hashKeyMasked: maskHashKey(merchant.hashKey),
      isActive: merchant.isActive,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),
    };
  }

  async getMerchantById(id: string, merchantScope?: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id } });
    if (!merchant || (merchantScope && merchant.merchantId !== merchantScope)) {
      throw new NotFoundException('Merchant not found');
    }
    return {
      id: merchant.id,
      merchantId: merchant.merchantId,
      name: merchant.name,
      hashKeyMasked: maskHashKey(merchant.hashKey),
      isActive: merchant.isActive,
      createdAt: merchant.createdAt.toISOString(),
      updatedAt: merchant.updatedAt.toISOString(),
    };
  }

  // Price Snapshots
  async queryPriceSnapshots(dto: QueryPriceSnapshotsDto) {
    const { page = 0, limit = 20, start, end, roundId, source } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.PriceSnapshotWhereInput = {};
    if (roundId !== undefined) where.roundId = roundId;
    if (source) where.source = source;
    if (startDate || endExclusive) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endExclusive) where.timestamp.lt = endExclusive;
    }

    const skip = page * limit;
    const take = limit + 1;

    const snapshots = await this.prisma.priceSnapshot.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take,
    });

    const hasNext = snapshots.length > limit;
    const items: PriceSnapshotResponseItem[] = snapshots
      .slice(0, limit)
      .map((s) => ({
        id: s.id,
        timestamp: s.timestamp.toISOString(),
        price: Number(s.price),
        source: s.source,
        roundId: s.roundId,
      }));

    return { page, limit, hasNext, items };
  }

  // Player Logins
  async queryPlayerLogins(dto: QueryPlayerLoginsDto, merchantScope?: string) {
    const { page = 0, limit = 20, start, end, merchantId, account } = dto;
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const where: Prisma.PlayerLoginWhereInput = {};
    if (merchantScope) where.merchantId = merchantScope;
    else if (merchantId) where.merchantId = merchantId;
    if (startDate || endExclusive) {
      where.loginTime = {};
      if (startDate) where.loginTime.gte = startDate;
      if (endExclusive) where.loginTime.lt = endExclusive;
    }
    if (account) {
      where.user = {
        OR: [
          { email: { contains: account, mode: 'insensitive' } },
          { merchantAccount: { contains: account, mode: 'insensitive' } },
        ],
      };
    }

    const skip = page * limit;
    const take = limit + 1;

    const logins = await this.prisma.playerLogin.findMany({
      where,
      include: { user: { select: { email: true, merchantAccount: true } } },
      orderBy: { loginTime: 'desc' },
      skip,
      take,
    });

    const hasNext = logins.length > limit;
    const items: PlayerLoginResponseItem[] = logins
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        merchantId: l.merchantId,
        playerId: l.userId,
        playerAccount: l.user.merchantAccount || l.user.email,
        loginTime: l.loginTime.toISOString(),
      }));

    return { page, limit, hasNext, items };
  }
}
