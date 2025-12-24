import { BetSide } from '@prisma/client';
import { RoundState } from './round-state.interface';
import { SettlementStats } from '../../bets/bets.service';

export type RoundEvent =
  | {
      type: 'round:start';
      payload: RoundState;
    }
  | {
      type: 'round:locked';
      payload: { roundId: number; lockedPrice: number | null };
    }
  | {
      type: 'round:result';
      payload: {
        roundId: number;
        lockedPrice: number | null;
        finalPrice: number | null;
        digitResult: string | null;
        digitSum: number | null;
        winningSide: BetSide | null;
        stats: SettlementStats;
      };
    };
