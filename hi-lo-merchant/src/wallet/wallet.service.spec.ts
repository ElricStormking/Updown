import { WalletService } from './wallet.service';

describe('WalletService', () => {
  it('creates a missing wallet with the user merchant currency', async () => {
    const prisma = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          userId: 'user-1',
          balance: 0,
          currency: 'JPY',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          merchant: { currency: 'JPY' },
        }),
      },
    };
    const service = new WalletService(prisma as any);

    await service.getOrCreateWallet('user-1');

    expect(prisma.wallet.create).toHaveBeenCalledTimes(1);
    expect(prisma.wallet.create.mock.calls[0][0].data.currency).toBe('JPY');
  });
});
