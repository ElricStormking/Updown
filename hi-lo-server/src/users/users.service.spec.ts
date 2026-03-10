import { UsersService } from './users.service';

describe('UsersService', () => {
  it('creates runtime users with the merchant currency on the wallet', async () => {
    const prisma = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          merchantId: 'MERCHANT001',
          currency: 'EUR',
        }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          wallet: { currency: 'EUR' },
        }),
      },
    };
    const service = new UsersService(prisma as any);

    await service.create({
      account: 'player123',
      password: 'password123',
      merchantId: 'MERCHANT001',
    });

    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.create.mock.calls[0][0].data.wallet.create.currency).toBe(
      'EUR',
    );
  });
});
