export type DigitOutcome = {
  digits: string;
  sum: number;
  counts: Record<string, number>;
  isTriple: boolean;
};

const PRICE_ROUNDING_PRECISION = 8;

export const roundPriceToCents = (price: number): number => {
  if (!Number.isFinite(price)) {
    throw new Error('Price must be finite');
  }

  const sign = price < 0 ? -1 : 1;
  const [integerPartRaw, fractionPartRaw = ''] = Math.abs(price)
    .toFixed(PRICE_ROUNDING_PRECISION)
    .split('.');
  const fractionPart = fractionPartRaw.padEnd(PRICE_ROUNDING_PRECISION, '0');
  const baseCents =
    Number(integerPartRaw) * 100 + Number(fractionPart.slice(0, 2));
  const shouldRoundUp = Number(fractionPart[2] ?? '0') >= 5;

  return sign * (baseCents + (shouldRoundUp ? 1 : 0));
};

export const formatRoundedPrice = (price: number): string => {
  const cents = roundPriceToCents(price);
  const sign = cents < 0 ? '-' : '';
  const absoluteCents = Math.abs(cents);
  const integerPart = Math.floor(absoluteCents / 100);
  const fractionPart = String(absoluteCents % 100).padStart(2, '0');

  return `${sign}${integerPart}.${fractionPart}`;
};

export const getDigitOutcome = (price: number): DigitOutcome => {
  const cents = roundPriceToCents(price);
  const lastThree = ((cents % 1000) + 1000) % 1000;
  const digits = lastThree.toString().padStart(3, '0');
  const counts: Record<string, number> = {
    '0': 0,
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '7': 0,
    '8': 0,
    '9': 0,
  };

  let sum = 0;
  for (const char of digits) {
    counts[char] += 1;
    sum += Number(char);
  }

  const isTriple = digits[0] === digits[1] && digits[1] === digits[2];

  return { digits, sum, counts, isTriple };
};
