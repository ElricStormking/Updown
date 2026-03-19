import {
  LaunchSessionOfflineStatus,
  LaunchSessionStatus,
} from '@prisma/client';
import { Subject } from 'rxjs';
import { GameGateway } from './game.gateway';

describe('GameGateway', () => {
  it('does not trigger update balance while the player still has a result-pending round', async () => {
    const launchSessionService = {
      getLaunchSessionById: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        status: LaunchSessionStatus.ACTIVE,
        loginStatus: 'VERIFIED',
        offlineStatus: LaunchSessionOfflineStatus.OFFLINE_PENDING,
        updatedAt: new Date('2026-03-19T23:59:00.000Z'),
        merchant: {
          merchantId: 'MERCHANT001',
        },
      }),
      hasPendingRoundSettlement: jest.fn().mockResolvedValue(true),
      claimUpdateBalanceCallback: jest.fn(),
      markUpdateBalanceResult: jest.fn(),
    };
    const merchantCallbackService = {
      sendUpdateBalance: jest.fn(),
    };
    const gateway = new GameGateway(
      {
        get: jest.fn((key: string) =>
          key === 'integration.offlineGraceMs' ? 30000 : undefined,
        ),
      } as any,
      {
        price$: jest.fn(() => new Subject()),
        getLatestPrice: jest.fn(),
      } as any,
      {
        events$: jest.fn(() => new Subject()),
        getCurrentRound: jest.fn(),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      launchSessionService as any,
      merchantCallbackService as any,
    );

    await (gateway as any).triggerUpdateBalanceIfStillOffline('session-1');

    expect(launchSessionService.hasPendingRoundSettlement).toHaveBeenCalledWith(
      'user-1',
    );
    expect(launchSessionService.claimUpdateBalanceCallback).not.toHaveBeenCalled();
    expect(merchantCallbackService.sendUpdateBalance).not.toHaveBeenCalled();
  });
});
