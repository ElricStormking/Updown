import { BetSide, RoundStatus } from '@prisma/client';

export interface RoundState {
  id: number;
  status: RoundStatus;
  startTime: string;
  lockTime: string;
  endTime: string;
  oddsUp: number;
  oddsDown: number;
  lockedPrice?: number | null;
  finalPrice?: number | null;
  winningSide?: BetSide | null;
}
