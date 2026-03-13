import { formatRoundedPrice, getDigitOutcome, roundPriceToCents } from './digit-bet.utils';

describe('digit-bet.utils', () => {
  it('rounds prices to cents consistently for displayed price and digit outcome', () => {
    expect(roundPriceToCents(69492.27)).toBe(6949227);
    expect(formatRoundedPrice(69492.27)).toBe('69492.27');
    expect(getDigitOutcome(69492.27).digits).toBe('227');
  });

  it('handles half-cent edge cases deterministically', () => {
    expect(roundPriceToCents(2.675)).toBe(268);
    expect(formatRoundedPrice(2.675)).toBe('2.68');
    expect(getDigitOutcome(2.675).digits).toBe('268');
  });
});
