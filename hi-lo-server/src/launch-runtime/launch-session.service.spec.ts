import { RoundStatus } from '@prisma/client';
import { LaunchSessionService } from './launch-session.service';

describe('LaunchSessionService', () => {
  it('detects a result-pending round for a player with unsettled bets', async () => {
    const prisma = {
      bet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'bet-1' }),
      },
    };
    const service = new LaunchSessionService(prisma as any, {} as any);

    const result = await service.hasPendingRoundSettlement('user-1');

    expect(prisma.bet.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        round: {
          status: RoundStatus.RESULT_PENDING,
        },
      },
      select: {
        id: true,
      },
    });
    expect(result).toBe(true);
  });
});
