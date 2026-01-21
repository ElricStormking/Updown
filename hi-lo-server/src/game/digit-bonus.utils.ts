import { DigitBetType } from '@prisma/client';

export type DigitBonusSlot = {
  digitType: DigitBetType;
  selection: string | null;
  bonusRatio?: number | null;
};

export type DigitBonusState = {
  factor: number;
  slots: DigitBonusSlot[];
};

// Sum of weights is treated as a chance out of this total for a slot to be bonus.
export const DEFAULT_BONUS_SLOT_CHANCE_TOTAL = 100000;

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

export const getBonusRatioForSlot = (
  digitType: DigitBetType | null,
  selection: string | null,
  bonusSlots: DigitBonusSlot[] | null | undefined,
) => {
  if (!digitType) return null;
  if (!bonusSlots?.length) return null;
  const key = buildDigitBetKey(digitType, selection);
  for (const slot of bonusSlots) {
    if (buildDigitBonusKey(slot) === key) {
      return typeof slot.bonusRatio === 'number' ? slot.bonusRatio : null;
    }
  }
  return null;
};

const collectWeightedRatios = (ratios: number[], weights: number[]) => {
  if (!Array.isArray(ratios) || !Array.isArray(weights)) return [];
  const entries: Array<{ ratio: number; weight: number }> = [];
  const limit = Math.min(ratios.length, weights.length);
  for (let i = 0; i < limit; i += 1) {
    const ratio = Number(ratios[i]);
    const weight = Number(weights[i]);
    if (!Number.isFinite(ratio)) continue;
    if (!Number.isFinite(weight) || weight <= 0) continue;
    entries.push({ ratio, weight });
  }
  return entries;
};

export const pickWeightedBonusRatio = (
  ratios: number[],
  weights: number[],
  rng: () => number = Math.random,
): number | null => {
  const entries = collectWeightedRatios(ratios, weights);
  if (!entries.length) return null;

  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;

  let roll = rng() * total;
  for (const entry of entries) {
    if (roll < entry.weight) return entry.ratio;
    roll -= entry.weight;
  }
  return entries[entries.length - 1]?.ratio ?? null;
};

export const pickBonusRatioWithChance = (
  ratios: number[],
  weights: number[],
  rng: () => number = Math.random,
  rollTotal: number = DEFAULT_BONUS_SLOT_CHANCE_TOTAL,
): number | null => {
  const entries = collectWeightedRatios(ratios, weights);
  if (!entries.length) return null;
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;

  const roll = rng() * rollTotal;
  if (roll >= total) return null;

  let pick = rng() * total;
  for (const entry of entries) {
    if (pick < entry.weight) return entry.ratio;
    pick -= entry.weight;
  }
  return entries[entries.length - 1]?.ratio ?? null;
};

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

  for (let sum = 1; sum <= 26; sum += 1) {
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

