import { DigitBetType } from '@prisma/client';
import {
  buildDigitBonusKey,
  getAllDigitBetSlots,
  pickBonusRatioWithChance,
  pickRandomDigitBonusSlots,
  pickWeightedBonusRatio,
} from './digit-bonus.utils';

describe('digit-bonus.utils', () => {
  it('getAllDigitBetSlots matches the client digit table layout (61 slots) and is unique', () => {
    const slots = getAllDigitBetSlots();
    expect(slots).toHaveLength(61);

    const keys = slots.map(buildDigitBonusKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);

    expect(keys).toContain(`${DigitBetType.SMALL}|`);
    expect(keys).toContain(`${DigitBetType.SINGLE}|0`);
    expect(keys).toContain(`${DigitBetType.DOUBLE}|11`);
    expect(keys).toContain(`${DigitBetType.TRIPLE}|777`);
    expect(keys).toContain(`${DigitBetType.SUM}|1`);
    expect(keys).toContain(`${DigitBetType.SUM}|26`);
  });

  it('pickRandomDigitBonusSlots returns N unique slots', () => {
    const rng = (() => {
      let x = 0.123;
      return () => {
        // simple deterministic generator for test
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
    })();

    const slots = pickRandomDigitBonusSlots(3, rng);
    expect(slots).toHaveLength(3);
    const keys = slots.map(buildDigitBonusKey);
    expect(new Set(keys).size).toBe(3);
  });

  it('pickWeightedBonusRatio returns null when no valid weights', () => {
    const ratio = pickWeightedBonusRatio([2, 3, 4, 5, 6], [0, 0, 0, 0, 0]);
    expect(ratio).toBeNull();
  });

  it('pickWeightedBonusRatio selects ratio based on weights', () => {
    const ratios = [2, 4, 6, 8, 10];
    const weights = [1, 0, 1, 0, 1];
    const first = pickWeightedBonusRatio(ratios, weights, () => 0);
    const last = pickWeightedBonusRatio(ratios, weights, () => 0.8);
    expect(first).toBe(2);
    expect(last).toBe(10);
  });

  it('pickBonusRatioWithChance skips bonus when roll exceeds total', () => {
    const ratios = [2, 4];
    const weights = [3, 7];
    const rng = (() => {
      const values = [0.2];
      let idx = 0;
      return () => values[idx++] ?? 0;
    })();

    const ratio = pickBonusRatioWithChance(ratios, weights, rng);
    expect(ratio).toBeNull();
  });

  it('pickBonusRatioWithChance selects ratio when roll is within total', () => {
    const ratios = [2, 4];
    const weights = [3, 7];
    const rng = (() => {
      const values = [0, 0.5];
      let idx = 0;
      return () => values[idx++] ?? 0;
    })();

    const ratio = pickBonusRatioWithChance(ratios, weights, rng);
    expect(ratio).toBe(4);
  });
});

