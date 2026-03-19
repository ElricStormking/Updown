import { Merchant, Prisma, WalletTxType } from '@prisma/client';
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

  it('returns transferAmount and zero balance for all-transfer-out', async () => {
    const tx = {
      transfer: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          merchantId: 'MERCHANT001',
          merchantAccount: 'player123',
        }),
      },
      transfer: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const walletService = {
      getOrCreateWallet: jest.fn().mockResolvedValue({
        balance: new Prisma.Decimal(150),
      }),
      adjustBalance: jest.fn().mockResolvedValue({
        balance: new Prisma.Decimal(0),
      }),
    };
    const launchSessionService = {
      closeActiveSessionsByAccount: jest.fn().mockResolvedValue(undefined),
    };
    const service = new IntegrationService(
      prisma as any,
      walletService as any,
      {} as any,
      {} as any,
      {} as any,
      launchSessionService as any,
    );
    (service as any).generateTransferId = jest.fn().mockReturnValue('TFTEST123');

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

    const response = await service.allTransferOut(
      merchant,
      'player123',
      'ALL-OUT-001',
      timestamp,
      hash,
    );

    expect(response).toEqual({
      success: true,
      errorCode: 0,
      errorMessage: '',
      data: {
        transferAmount: 150,
        balance: 0,
      },
    });
    expect(walletService.adjustBalance).toHaveBeenCalledWith(
      'user-1',
      expect.any(Prisma.Decimal),
      {
        type: WalletTxType.TRANSFER_OUT,
        merchantId: 'MERCHANT001',
        referenceId: 'TFTEST123',
      },
      tx,
    );
    expect(launchSessionService.closeActiveSessionsByAccount).toHaveBeenCalledWith(
      'MERCHANT001',
      'player123',
    );
  });
});
