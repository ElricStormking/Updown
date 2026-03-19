import {
  LaunchSessionOfflineStatus,
  LaunchSessionStatus,
} from '@prisma/client';
import { LaunchSessionOfflineService } from './launch-session-offline.service';

describe('LaunchSessionOfflineService', () => {
  it('does not send update balance while the player still has a result-pending round', async () => {
    const cutoff = new Date('2026-03-20T00:00:00.000Z');
    const prisma = {
      merchantLaunchSession: {
        findUnique: jest.fn().mockResolvedValue({
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
      },
    };
    const launchSessionService = {
      hasPendingRoundSettlement: jest.fn().mockResolvedValue(true),
      markOfflinePending: jest.fn(),
      claimUpdateBalanceCallback: jest.fn(),
      markUpdateBalanceResult: jest.fn(),
    };
    const merchantCallbackService = {
      sendUpdateBalance: jest.fn(),
    };
    const service = new LaunchSessionOfflineService(
      prisma as any,
      {} as any,
      launchSessionService as any,
      merchantCallbackService as any,
    );

    await (service as any).processSession('session-1', cutoff);

    expect(launchSessionService.hasPendingRoundSettlement).toHaveBeenCalledWith(
      'user-1',
    );
    expect(launchSessionService.claimUpdateBalanceCallback).not.toHaveBeenCalled();
    expect(merchantCallbackService.sendUpdateBalance).not.toHaveBeenCalled();
  });
});
