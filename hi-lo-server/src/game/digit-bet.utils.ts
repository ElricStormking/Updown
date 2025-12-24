export type DigitOutcome = {
  digits: string;
  sum: number;
  counts: Record<string, number>;
  isTriple: boolean;
};

export const getDigitOutcome = (price: number): DigitOutcome => {
  const cents = Math.round(price * 100);
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
