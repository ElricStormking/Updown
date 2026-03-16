import { LaunchSessionStatus } from '@prisma/client';
import { AdminDataService } from './admin-data.service';

describe('AdminDataService', () => {
  it('queries bets by player account text and partial text filters', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'user-3' }]),
      },
      bet: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new AdminDataService(prisma as any);

    await service.queryBets({
      betId: 'abc12345',
      merchantId: 'qamer',
      player: 'testplayer3',
      page: 0,
      limit: 20,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: 'testplayer3' },
          {
            email: {
              contains: 'testplayer3',
              mode: 'insensitive',
            },
          },
          {
            merchantAccount: {
              contains: 'testplayer3',
              mode: 'insensitive',
            },
          },
          {
            launchSessions: {
              some: {
                account: {
                  contains: 'testplayer3',
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            launchSessions: {
              some: {
                playerId: {
                  contains: 'testplayer3',
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },
      select: { id: true },
      take: 200,
    });
    expect(prisma.bet.findMany).toHaveBeenCalledWith({
      where: {
        id: { contains: 'abc12345', mode: 'insensitive' },
        merchantId: { contains: 'qamer', mode: 'insensitive' },
        userId: { in: ['user-3'] },
      },
      include: { user: { select: { email: true, merchantAccount: true } } },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 21,
    });
  });

  it('returns an empty page when no player matches the search term', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      bet: {
        findMany: jest.fn(),
      },
    };
    const service = new AdminDataService(prisma as any);

    const result = await service.queryBets({
      player: 'missing-player',
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({
      page: 1,
      limit: 20,
      hasNext: false,
      items: [],
    });
    expect(prisma.bet.findMany).not.toHaveBeenCalled();
  });

  it('propagates merchant currency changes to wallets and active launch sessions', async () => {
    const existingMerchant = {
      id: 'merchant-db-id',
      merchantId: 'MERCHANT001',
      name: 'Merchant One',
      hashKey: 'hash-key',
      currency: 'USDT',
      callbackEnabled: false,
      loginPlayerCallbackUrl: null,
      updateBalanceCallbackUrl: null,
      integrationAllowedIps: ['203.0.113.10'],
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    };
    const updatedMerchant = {
      ...existingMerchant,
      currency: 'TWD',
      updatedAt: new Date('2026-03-10T00:00:00.000Z'),
    };
    const tx = {
      merchant: {
        update: jest.fn().mockResolvedValue(updatedMerchant),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      },
      wallet: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      merchantLaunchSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue(existingMerchant),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = new AdminDataService(prisma as any);

    const result = await service.updateMerchant(existingMerchant.id, {
      currency: 'TWD',
    });

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['user-1', 'user-2'],
        },
      },
      data: {
        currency: 'TWD',
      },
    });
    expect(tx.merchantLaunchSession.updateMany).toHaveBeenCalledWith({
      where: {
        merchantId: 'MERCHANT001',
        status: LaunchSessionStatus.ACTIVE,
      },
      data: {
        currency: 'TWD',
      },
    });
    expect(result.currency).toBe('TWD');
  });
});
