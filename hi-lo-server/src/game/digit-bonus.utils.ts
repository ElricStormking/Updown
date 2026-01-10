import { DigitBetType } from '@prisma/client';

export type DigitBonusSlot = {
  digitType: DigitBetType;
  selection: string | null;
};

export type DigitBonusState = {
  factor: number;
  slots: DigitBonusSlot[];
};

export const buildDigitBonusKey = (slot: DigitBonusSlot) =>
  `${slot.digitType}|${slot.selection ?? ''}`;

export const buildDigitBetKey = (digitType: DigitBetType, selection: string | null) =>
  `${digitType}|${selection ?? ''}`;

export const isBonusDigitBet = (
  digitType: DigitBetType | null,
  selection: string | null,
  bonusSlots: DigitBonusSlot[] | null | undefined,
) => {
  if (!digitType) return false;
  if (!bonusSlots?.length) return false;
  const key = buildDigitBetKey(digitType, selection);
  for (const slot of bonusSlots) {
    if (buildDigitBonusKey(slot) === key) return true;
  }
  return false;
};

export const applyBonusFactor = (payoutMultiplier: number, factor: number) =>
  payoutMultiplier * factor;

export const getAllDigitBetSlots = (): DigitBonusSlot[] => {
  const slots: DigitBonusSlot[] = [];

  // Mirrors hi-lo-client/src/ui/domControls.ts buildDigitBetTable()
  slots.push({ digitType: DigitBetType.SMALL, selection: null });
  slots.push({ digitType: DigitBetType.ODD, selection: null });
  slots.push({ digitType: DigitBetType.ANY_TRIPLE, selection: null });
  slots.push({ digitType: DigitBetType.EVEN, selection: null });
  slots.push({ digitType: DigitBetType.BIG, selection: null });

  for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
    slots.push({ digitType: DigitBetType.SINGLE, selection: d });
  }

  for (const d of ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99']) {
    slots.push({ digitType: DigitBetType.DOUBLE, selection: d });
  }

  for (const d of [
    '000',
    '111',
    '222',
    '333',
    '444',
    '555',
    '666',
    '777',
    '888',
    '999',
  ]) {
    slots.push({ digitType: DigitBetType.TRIPLE, selection: d });
  }

  for (let sum = 4; sum <= 23; sum += 1) {
    slots.push({ digitType: DigitBetType.SUM, selection: String(sum) });
  }

  return slots;
};

export const pickRandomDigitBonusSlots = (
  slotCount: number,
  rng: () => number = Math.random,
): DigitBonusSlot[] => {
  const all = getAllDigitBetSlots();
  if (slotCount <= 0) return [];
  if (slotCount >= all.length) return all;

  // Partial Fisher–Yates shuffle.
  for (let i = all.length - 1; i > all.length - 1 - slotCount; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.slice(all.length - slotCount);
};

