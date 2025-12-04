import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bet, BetResult, BetSide, Prisma, RoundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { PlaceBetDto } from './dto/place-bet.dto';
import { AppConfig } from '../config/configuration';

export interface PlacedBetPayload {
  bet: Bet;
  walletBalance: Prisma.Decimal;
}

export interface SettlementStats {
  totalBets: number;
  winners: number;
  refunded: number;
  totalVolume: number;
  balanceUpdates: Array<{ userId: string; balance: number }>;
}

@Injectable()
export class BetsService {
  private readonly logger = new Logger(BetsService.name);

  private readonly minBet: number;
  private readonly maxBet: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    this.minBet = this.configService.getOrThrow<number>('game.minBetAmount', {
      infer: true,
    });
    this.maxBet = this.configService.getOrThrow<number>('game.maxBetAmount', {
      infer: true,
    });
  }

  async placeBet(userId: string, dto: PlaceBetDto): Promise<PlacedBetPayload> {
    if (dto.amount < this.minBet || dto.amount > this.maxBet) {
      throw new BadRequestException(
        `Bet amount must be between ${this.minBet} and ${this.maxBet}`,
      );
    }

    const round = await this.prisma.round.findUnique({
      where: { id: dto.roundId },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }
    if (round.status !== RoundStatus.BETTING) {
      throw new BadRequestException('Betting window is closed for this round');
    }
    if (round.lockTime.getTime() <= Date.now()) {
      throw new BadRequestException('Round already locked');
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);
    const odds =
      dto.side === BetSide.UP
        ? new Prisma.Decimal(round.oddsUp)
        : new Prisma.Decimal(round.oddsDown);

    const bet = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balance = new Prisma.Decimal(wallet.balance);
      if (balance.lt(amountDecimal)) {
        throw new BadRequestException('Insufficient balance');
      }

      const createdBet = await tx.bet.create({
        data: {
          userId,
          roundId: dto.roundId,
          side: dto.side,
          amount: amountDecimal,
          odds,
        },
      });

      const updatedWallet = await this.walletService.adjustBalance(
        userId,
        amountDecimal.mul(-1),
        tx,
      );

      return {
        bet: createdBet,
        walletBalance: new Prisma.Decimal(updatedWallet.balance),
      };
    });

    return bet;
  }

  async settleRound(
    roundId: number,
    winningSide: BetSide | null,
  ): Promise<SettlementStats> {
    const bets = await this.prisma.bet.findMany({
      where: { roundId },
    });

    if (!bets.length) {
      return {
        totalBets: 0,
        winners: 0,
        refunded: 0,
        totalVolume: 0,
        balanceUpdates: [],
      };
    }

    let winners = 0;
    let refunded = 0;
    let totalVolume = new Prisma.Decimal(0);
    const balanceUpdates: SettlementStats['balanceUpdates'] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const bet of bets) {
        totalVolume = totalVolume.add(bet.amount);

        if (!winningSide) {
          await this.processRefund(tx, bet, balanceUpdates);
          refunded += 1;
          continue;
        }

        if (bet.side === winningSide) {
          await this.processWin(tx, bet, balanceUpdates);
          winners += 1;
        } else {
          await this.markLoss(tx, bet.id);
        }
      }
    });

    if (winningSide === null) {
      this.logger.log(
        `Round ${roundId} refunded ${refunded} bets (total ${bets.length})`,
      );
    } else {
      this.logger.log(
        `Round ${roundId} settled. Winners: ${winners}/${bets.length}`,
      );
    }

    return {
      totalBets: bets.length,
      winners,
      refunded,
      totalVolume: Number(totalVolume),
      balanceUpdates,
    };
  }

  private async processRefund(
    tx: Prisma.TransactionClient,
    bet: Bet,
    updates: SettlementStats['balanceUpdates'],
  ) {
    const wallet = await this.walletService.adjustBalance(
      bet.userId,
      bet.amount,
      tx,
    );
    updates.push({
      userId: bet.userId,
      balance: Number(wallet.balance),
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        result: BetResult.REFUND,
        payout: bet.amount,
      },
    });
  }

  private async processWin(
    tx: Prisma.TransactionClient,
    bet: Bet,
    updates: SettlementStats['balanceUpdates'],
  ) {
    const payout = new Prisma.Decimal(bet.amount).mul(bet.odds);
    const wallet = await this.walletService.adjustBalance(
      bet.userId,
      payout,
      tx,
    );
    updates.push({
      userId: bet.userId,
      balance: Number(wallet.balance),
    });
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        result: BetResult.WIN,
        payout,
      },
    });
  }

  private async markLoss(tx: Prisma.TransactionClient, betId: string) {
    await tx.bet.update({
      where: { id: betId },
      data: {
        result: BetResult.LOSE,
        payout: new Prisma.Decimal(0),
      },
    });
  }
}
