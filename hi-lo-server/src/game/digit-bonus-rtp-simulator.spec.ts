import { DigitBetType } from '@prisma/client';
import type { GameConfigSnapshot } from '../config/game-config.defaults';
import { GameConfigService } from '../config/game-config.service';
import {
  bonusRtpSimulationDefaults,
  formatBonusSlotRtpValidationFailure,
  simulateAllBonusSlotRtpValidations,
  simulateBonusSlotRtpValidation,
} from './digit-bonus-rtp-simulator';
import { buildDigitBetKey, getAllDigitBetSlots } from './digit-bonus.utils';

jest.setTimeout(30_000);

const cloneConfig = (config: GameConfigSnapshot): GameConfigSnapshot =>
  JSON.parse(JSON.stringify(config)) as GameConfigSnapshot;

describe('digit-bonus-rtp-simulator', () => {
  let config: GameConfigSnapshot;

  beforeAll(async () => {
    const prisma = {
      gameConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    } as any;

    const service = new GameConfigService(prisma);
    config = await service.getActiveConfig();
  });

  it('loads the normalized default config without database records', () => {
    expect(config.configVersion).toBe('default');
    expect(config.bonusSlotChanceTotal).toBe(100000);
    expect(Object.keys(config.digitBonusRatios)).toHaveLength(
      getAllDigitBetSlots().length,
    );
  });

  it('validates all bonus slots over 100000 trials', () => {
    const summary = simulateAllBonusSlotRtpValidations(
      config,
      bonusRtpSimulationDefaults.sampleCount,
      bonusRtpSimulationDefaults.seed,
    );
    const failures = summary.results.filter((result) => !result.pass);
    if (failures.length > 0) {
      throw new Error(
        failures
          .map((result) => formatBonusSlotRtpValidationFailure(result))
          .join('\n\n'),
      );
    }
  });

  it('keeps zero-weight slots on the base RTP path', () => {
    const slotKey = buildDigitBetKey(DigitBetType.SMALL, null);
    const result = simulateBonusSlotRtpValidation(
      config,
      slotKey,
      bonusRtpSimulationDefaults.sampleCount,
      bonusRtpSimulationDefaults.seed,
    );

    expect(result.expectedBonusHitPct).toBe(0);
    expect(result.observedBonusHitPct).toBe(0);
    expect(result.expectedRuntimeRtpPct).toBeCloseTo(result.expectedRtpPct, 10);
    expect(result.observedRtpPct).toBeCloseTo(result.expectedRtpPct, 10);
    expect(result.bucketResults).toEqual([
      expect.objectContaining({
        ratio: null,
        observedCount: bonusRtpSimulationDefaults.sampleCount,
        pass: true,
      }),
    ]);
  });

  it('uses all three single suggest-win channels in RTP math', () => {
    const next = cloneConfig(config);
    const slotKey = buildDigitBetKey(DigitBetType.SINGLE, '7');
    next.digitBonusRatios[slotKey] = {
      ratios: [0, 0, 0, 0, 0],
      weights: [0, 0, 0, 0, 0],
    };
    next.digitPayouts.bySlot[slotKey] = 1;
    next.digitPayouts.single.double = 8;
    next.digitPayouts.single.triple = 30;
    next.digitPayouts.bySlotMeta[slotKey] = {
      ...next.digitPayouts.bySlotMeta[slotKey],
      suggestWinPct: 10,
      suggestWinPctDouble: 20,
      suggestWinPctTriple: 30,
      totalCounts: 100000,
      rtpFoolProofPct: 0,
    };

    const result = simulateBonusSlotRtpValidation(next, slotKey, 64, 42);
    const expected = 10 * (1 + 1) + 20 * (1 + 8) + 30 * (1 + 30);

    expect(result.expectedRtpPct).toBeCloseTo(expected, 10);
    expect(result.expectedRuntimeRtpPct).toBeCloseTo(expected, 10);
    expect(result.observedRtpPct).toBeCloseTo(expected, 10);
  });

  it('falls back to the global bonus slot chance total when totalCounts is missing or non-positive', () => {
    const next = cloneConfig(config);
    const slotKey = buildDigitBetKey(DigitBetType.DOUBLE, '11');
    next.bonusSlotChanceTotal = 54321;
    next.digitPayouts.bySlotMeta[slotKey] = {
      ...next.digitPayouts.bySlotMeta[slotKey],
      totalCounts: 0,
    };

    const result = simulateBonusSlotRtpValidation(next, slotKey, 1024, 99);

    expect(result.runtimeRollTotal).toBe(54321);
    expect(result.configuredBaseWeight).toBe(54321);
    expect(result.displayTotalCounts).toBeCloseTo(
      54321 + result.bonusWeightSum,
      10,
    );
    expect(result.rtpTotalRoll).toBeCloseTo(
      54321 + result.bonusWeightSum,
      10,
    );
  });
});
