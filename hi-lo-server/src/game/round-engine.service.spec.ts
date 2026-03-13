import { RoundStatus } from '@prisma/client';
import { RoundEngineService } from './round-engine.service';

describe('RoundEngineService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not emit round:result when finalize persistence fails', async () => {
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'roundState.ttlMs') return 30_000;
        if (key === 'game.digitBonus') {
          return {
            enabled: true,
            minSlots: 1,
            maxSlots: 3,
            payoutFactor: 2,
          };
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    };
    const redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const betsService = {
      settleRound: jest.fn().mockRejectedValue(new Error('persist failed')),
    };
    const binancePrice = {
      getLatestPrice: jest
        .fn()
        .mockResolvedValue({ price: 69492.27, timestamp: Date.now() }),
    };

    const service = new RoundEngineService(
      {} as any,
      configService as any,
      {} as any,
      binancePrice as any,
      redis as any,
      betsService as any,
    );
    const events: Array<{ type: string }> = [];
    const subscription = service.events$().subscribe((event) =>
      events.push({ type: event.type }),
    );

    (service as any).currentRound = {
      id: 159702,
      status: RoundStatus.RESULT_PENDING,
      startTime: new Date('2026-03-13T10:30:00.000Z').toISOString(),
      lockTime: new Date('2026-03-13T10:30:10.000Z').toISOString(),
      endTime: new Date('2026-03-13T10:30:20.000Z').toISOString(),
      oddsUp: 1.95,
      oddsDown: 1.95,
      lockedPrice: 69490,
    };

    await (service as any).finishCurrentRound();

    expect(events).toHaveLength(0);
    expect((service as any).currentRound).toBeDefined();
    expect((service as any).currentRound.status).toBe(
      RoundStatus.RESULT_PENDING,
    );
    expect((service as any).resultTimer).toBeDefined();
    expect(redis.del).not.toHaveBeenCalledWith(
      'game:round:active',
      'game:round:active:finalization',
    );

    subscription.unsubscribe();
  });
});
