import { Merchant } from '@prisma/client';
import { IntegrationController } from './integration.controller';

describe('IntegrationController', () => {
  it('returns transferAmount for all-transfer-out', async () => {
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
    const integrationService = {
      allTransferOut: jest.fn().mockResolvedValue({
        success: true,
        errorCode: 0,
        errorMessage: '',
        data: {
          transferAmount: 150,
          balance: 0,
        },
      }),
    };
    const controller = new IntegrationController(integrationService as any);
    const dto = {
      merchantId: 'MERCHANT001',
      account: 'player123',
      transferId: 'ALL-OUT-001',
      timestamp: 1700000000,
      hash: 'signed',
    };
    const req = {
      merchant,
    };

    const response = await controller.allTransferOut(dto as any, req);

    expect(integrationService.allTransferOut).toHaveBeenCalledWith(
      merchant,
      'player123',
      'ALL-OUT-001',
      1700000000,
      'signed',
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
  });
});
