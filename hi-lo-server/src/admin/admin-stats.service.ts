import { BadRequestException, Injectable } from '@nestjs/common';
import { BetResult, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DailyRtpRow = {
  day: Date;
  total_stake: unknown;
  total_payout: unknown;
  bets: unknown;
};

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

const toNumber = (value: unknown) => {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

@Injectable()
export class AdminStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyRtp(start?: string, end?: string) {
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    const endExclusive = endDate
      ? new Date(endDate.getTime() + MS_PER_DAY)
      : null;

    const filters: Prisma.Sql[] = [
      Prisma.sql`b."result" != ${BetResult.PENDING}::"BetResult"`,
    ];
    if (startDate) {
      filters.push(Prisma.sql`b."createdAt" >= ${startDate}`);
    }
    if (endExclusive) {
      filters.push(Prisma.sql`b."createdAt" < ${endExclusive}`);
    }

    const where = Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`;

    const rows = await this.prisma.$queryRaw<DailyRtpRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', b."createdAt") AS day,
        SUM(b.amount) AS total_stake,
        SUM(b.payout) AS total_payout,
        COUNT(*) AS bets
      FROM "Bet" b
      ${where}
      GROUP BY day
      ORDER BY day DESC
    `);

    return rows.map((row) => {
      const day =
        row.day instanceof Date
          ? row.day.toISOString().slice(0, 10)
          : String(row.day).slice(0, 10);
      const totalStake = toNumber(row.total_stake);
      const totalPayout = toNumber(row.total_payout);
      const bets = toNumber(row.bets);
      const rtp = totalStake > 0 ? totalPayout / totalStake : 0;
      return {
        day,
        totalStake,
        totalPayout,
        net: totalPayout - totalStake,
        rtp,
        bets,
      };
    });
  }
}
