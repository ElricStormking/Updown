import { DigitBetType } from '@prisma/client';
import {
  buildDigitBonusKey,
  getAllDigitBetSlots,
  pickRandomDigitBonusSlots,
} from './digit-bonus.utils';

describe('digit-bonus.utils', () => {
  it('getAllDigitBetSlots matches the client digit table layout (55 slots) and is unique', () => {
    const slots = getAllDigitBetSlots();
    expect(slots).toHaveLength(55);

    const keys = slots.map(buildDigitBonusKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);

    expect(keys).toContain(`${DigitBetType.SMALL}|`);
    expect(keys).toContain(`${DigitBetType.SINGLE}|0`);
    expect(keys).toContain(`${DigitBetType.DOUBLE}|11`);
    expect(keys).toContain(`${DigitBetType.TRIPLE}|777`);
    expect(keys).toContain(`${DigitBetType.SUM}|23`);
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
});

