import { Injectable } from '@nestjs/common';
import {
  LaunchSessionOfflineStatus,
  LaunchSessionStatus,
  MerchantLaunchSession,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type LaunchSessionWithMerchant = Prisma.MerchantLaunchSessionGetPayload<{
  include: { merchant: true };
}>;

@Injectable()
export class LaunchSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createOrReplaceActiveSession(input: {
    merchantId: string;
    userId: string;
    account: string;
    playerId: string;
    merchantAccessToken: string;
    currency: string;
  }): Promise<MerchantLaunchSession> {
    const ttlSec =
      this.configService.get<number>('integration.launchSessionTtlSec') ?? 3600;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSec * 1000);

    return this.prisma.$transaction(async (tx) => {
      await tx.merchantLaunchSession.updateMany({
        where: {
          merchantId: input.merchantId,
          userId: input.userId,
          status: LaunchSessionStatus.ACTIVE,
        },
        data: {
          status: LaunchSessionStatus.SUPERSEDED,
        },
      });

      return tx.merchantLaunchSession.create({
        data: {
          merchantId: input.merchantId,
          userId: input.userId,
          account: input.account,
          playerId: input.playerId,
          merchantAccessToken: input.merchantAccessToken,
          currency: input.currency,
          status: LaunchSessionStatus.ACTIVE,
          loginStatus: 'PENDING',
          offlineStatus: LaunchSessionOfflineStatus.ONLINE,
          expiresAt,
        },
      });
    });
  }

  async getLaunchSessionForUser(
    sessionId: string,
    userId: string,
    merchantId: string,
  ): Promise<LaunchSessionWithMerchant | null> {
    const session = await this.prisma.merchantLaunchSession.findUnique({
      where: { id: sessionId },
      include: { merchant: true },
    });

    if (!session) {
      return null;
    }
    if (session.userId !== userId || session.merchantId !== merchantId) {
      return null;
    }

    return this.expireSessionIfNeeded(session);
  }

  async getLaunchSessionById(
    sessionId: string,
  ): Promise<LaunchSessionWithMerchant | null> {
    const session = await this.prisma.merchantLaunchSession.findUnique({
      where: { id: sessionId },
      include: { merchant: true },
    });
    if (!session) {
      return null;
    }
    return this.expireSessionIfNeeded(session);
  }

  async markLoginVerified(sessionId: string): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: sessionId,
        status: LaunchSessionStatus.ACTIVE,
      },
      data: {
        loginStatus: 'VERIFIED',
        loginVerifiedAt: new Date(),
      },
    });
  }

  async markLoginFailed(sessionId: string): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: sessionId,
        status: LaunchSessionStatus.ACTIVE,
      },
      data: {
        loginStatus: 'FAILED',
      },
    });
  }

  async markOnline(sessionId: string): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: sessionId,
        status: LaunchSessionStatus.ACTIVE,
        offlineStatus: {
          in: [
            LaunchSessionOfflineStatus.ONLINE,
            LaunchSessionOfflineStatus.OFFLINE_PENDING,
            LaunchSessionOfflineStatus.CALLBACK_FAILED,
          ],
        },
      },
      data: {
        offlineStatus: LaunchSessionOfflineStatus.ONLINE,
      },
    });
  }

  async markOfflinePending(sessionId: string): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: sessionId,
        status: LaunchSessionStatus.ACTIVE,
        offlineStatus: {
          in: [
            LaunchSessionOfflineStatus.ONLINE,
            LaunchSessionOfflineStatus.CALLBACK_FAILED,
          ],
        },
      },
      data: {
        offlineStatus: LaunchSessionOfflineStatus.OFFLINE_PENDING,
      },
    });
  }

  async markUpdateBalanceResult(
    sessionId: string,
    success: boolean,
  ): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: sessionId,
        status: LaunchSessionStatus.ACTIVE,
      },
      data: success
        ? {
            offlineStatus: LaunchSessionOfflineStatus.CALLBACK_SENT,
            updateBalanceSentAt: new Date(),
          }
        : {
            offlineStatus: LaunchSessionOfflineStatus.CALLBACK_FAILED,
          },
    });
  }

  async closeActiveSessionsByAccount(
    merchantId: string,
    account: string,
  ): Promise<void> {
    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        merchantId,
        account,
        status: LaunchSessionStatus.ACTIVE,
      },
      data: {
        status: LaunchSessionStatus.CLOSED,
        offlineStatus: LaunchSessionOfflineStatus.SETTLED,
        settledAt: new Date(),
      },
    });
  }

  private async expireSessionIfNeeded(
    session: LaunchSessionWithMerchant,
  ): Promise<LaunchSessionWithMerchant> {
    const now = Date.now();
    if (
      session.status !== LaunchSessionStatus.ACTIVE ||
      session.expiresAt.getTime() > now
    ) {
      return session;
    }

    await this.prisma.merchantLaunchSession.updateMany({
      where: {
        id: session.id,
        status: LaunchSessionStatus.ACTIVE,
      },
      data: {
        status: LaunchSessionStatus.EXPIRED,
      },
    });

    return {
      ...session,
      status: LaunchSessionStatus.EXPIRED,
    };
  }
}

