import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  private readonly maxPlayerHistory: number;
  private readonly maxRoundHistory: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.maxPlayerHistory = this.configService.getOrThrow<number>(
      'history.playerLimit',
      { infer: true },
    );
    this.maxRoundHistory = this.configService.getOrThrow<number>(
      'history.roundLimit',
      { infer: true },
    );
  }

  getPlayerBets(userId: string, limit?: number) {
    const resolvedLimit = this.resolveLimit(limit, this.maxPlayerHistory);
    return this.prisma.bet
      .findMany({
        where: { userId },
        include: {
          round: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: resolvedLimit,
      })
      .then((bets) =>
        bets.map((bet) => ({
          id: bet.id,
          roundId: bet.roundId,
          side: bet.side,
          amount: Number(bet.amount),
          odds: Number(bet.odds),
          result: bet.result,
          payout: Number(bet.payout),
          createdAt: bet.createdAt,
          lockedPrice: bet.round.lockedPrice
            ? Number(bet.round.lockedPrice)
            : null,
          finalPrice: bet.round.finalPrice
            ? Number(bet.round.finalPrice)
            : null,
          winningSide: bet.round.winningSide,
        })),
      );
  }

  getRoundHistory(limit?: number) {
    const resolvedLimit = this.resolveLimit(limit, this.maxRoundHistory);
    return this.prisma.round
      .findMany({
        orderBy: {
          id: 'desc',
        },
        take: resolvedLimit,
      })
      .then((rounds) =>
        rounds.map((round) => ({
          id: round.id,
          status: round.status,
          startTime: round.startTime,
          lockTime: round.lockTime,
          endTime: round.endTime,
          lockedPrice: round.lockedPrice ? Number(round.lockedPrice) : null,
          finalPrice: round.finalPrice ? Number(round.finalPrice) : null,
          winningSide: round.winningSide,
          oddsUp: Number(round.oddsUp),
          oddsDown: Number(round.oddsDown),
        })),
      );
  }

  private resolveLimit(provided: number | undefined, cap: number) {
    const limit = Number.isFinite(provided) ? Number(provided) : cap;
    return Math.max(1, Math.min(cap, limit));
  }
}
