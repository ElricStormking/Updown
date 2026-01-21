import { BetSide, DigitBetType, RoundStatus } from '@prisma/client';

export interface DigitBonusSlotState {
  digitType: DigitBetType;
  selection: string | null;
  bonusRatio?: number | null;
}

export interface RoundState {
  id: number;
  status: RoundStatus;
  startTime: string;
  lockTime: string;
  endTime: string;
  oddsUp: number;
  oddsDown: number;
  configVersion?: string | null;
  digitBonus?: {
    factor?: number | null;
    slots: DigitBonusSlotState[];
  };
  lockedPrice?: number | null;
  finalPrice?: number | null;
  winningSide?: BetSide | null;
}
