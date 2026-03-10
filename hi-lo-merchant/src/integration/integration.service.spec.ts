import { Merchant } from '@prisma/client';
import { IntegrationService } from './integration.service';
import { generateSignature } from './utils/signature.utils';

describe('IntegrationService', () => {
  it('creates merchant accounts with the merchant currency on the wallet', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };
    const service = new IntegrationService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const merchant: Merchant = {
      id: 'merchant-db-id',
      merchantId: 'MERCHANT001',
      name: 'Merchant One',
      hashKey: 'merchant-secret',
      integrationAllowedIps: ['203.0.113.10'],
      currency: 'TWD',
      callbackEnabled: false,
      loginPlayerCallbackUrl: null,
      updateBalanceCallbackUrl: null,
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    };
    const timestamp = 1700000000;
    const hash = generateSignature(
      [merchant.merchantId, 'player123', timestamp.toString()],
      merchant.hashKey,
    );

    const response = await service.createAccount(
      merchant,
      'player123',
      timestamp,
      hash,
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'MERCHANT001_player123@merchant.local',
        password: '',
        merchantId: 'MERCHANT001',
        merchantAccount: 'player123',
        wallet: {
          create: {
            balance: expect.anything(),
            currency: 'TWD',
          },
        },
      },
    });
    expect(response.success).toBe(true);
  });
});
