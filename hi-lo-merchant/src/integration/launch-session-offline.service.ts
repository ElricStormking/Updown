import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import {
  LaunchSessionLoginStatus,
  LaunchSessionOfflineStatus,
  LaunchSessionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';

type LaunchSessionWithMerchant = Prisma.MerchantLaunchSessionGetPayload<{
  include: { merchant: true };
}>;

const OFFLINE_SWEEP_INTERVAL_MS = 5000;
const OFFLINE_SWEEP_BATCH_SIZE = 50;

@Injectable()
export class LaunchSessionOfflineService {
  private readonly logger = new Logger(LaunchSessionOfflineService.name);
  private sweepInProgress = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly launchSessionService: LaunchSessionService,
    private readonly merchantCallbackService: MerchantCallbackService,
  ) {}

  @Interval(OFFLINE_SWEEP_INTERVAL_MS)
  async sweepOfflineLaunchSessions(): Promise<void> {
    if (this.sweepInProgress) {
      return;
    }

    this.sweepInProgress = true;
    try {
      const callbackStaleBefore = this.getCallbackStaleBefore();
      await this.launchSessionService.recoverStaleSendingCallbacks(
        callbackStaleBefore,
      );

      const cutoff = this.getOfflineCutoff();
      const sessions = await this.findSessionsEligibleForOfflineCallback(cutoff);
      for (const session of sessions) {
        await this.processSession(session.id, cutoff);
      }
    } catch (error) {
      this.logger.error('Offline launch-session sweep failed', error as Error);
    } finally {
      this.sweepInProgress = false;
    }
  }

  private getOfflineCutoff(): Date {
    const offlineGraceMs =
      this.configService.get<number>('integration.offlineGraceMs') ?? 30000;
    return new Date(Date.now() - offlineGraceMs);
  }

  private getCallbackStaleBefore(): Date {
    const timeoutMs =
      this.configService.get<number>('integration.callbackTimeoutMs') ?? 5000;
    const retryCount =
      this.configService.get<number>('integration.callbackRetryCount') ?? 2;
    const bufferMs = 1000;
    return new Date(Date.now() - timeoutMs * (retryCount + 1) - bufferMs);
  }

  private async findSessionsEligibleForOfflineCallback(
    cutoff: Date,
  ): Promise<
    LaunchSessionWithMerchant[]
  > {
    return this.prisma.merchantLaunchSession.findMany({
      where: {
        status: LaunchSessionStatus.ACTIVE,
        loginStatus: LaunchSessionLoginStatus.VERIFIED,
        offlineStatus: {
          in: [
            LaunchSessionOfflineStatus.ONLINE,
            LaunchSessionOfflineStatus.OFFLINE_PENDING,
            LaunchSessionOfflineStatus.CALLBACK_FAILED,
          ],
        },
        updatedAt: {
          lte: cutoff,
        },
      },
      include: {
        merchant: true,
      },
      orderBy: {
        updatedAt: 'asc',
      },
      take: OFFLINE_SWEEP_BATCH_SIZE,
    });
  }

  private async processSession(sessionId: string, cutoff: Date): Promise<void> {
    let current = await this.prisma.merchantLaunchSession.findUnique({
      where: { id: sessionId },
      include: { merchant: true },
    });
    if (!current) {
      return;
    }
    if (current.status !== LaunchSessionStatus.ACTIVE) {
      return;
    }
    if (current.loginStatus !== LaunchSessionLoginStatus.VERIFIED) {
      return;
    }
    if (current.updatedAt > cutoff) {
      return;
    }
    if (
      await this.launchSessionService.hasPendingRoundSettlement(current.userId)
    ) {
      return;
    }
    if (current.offlineStatus === LaunchSessionOfflineStatus.ONLINE) {
      await this.launchSessionService.markOfflinePending(current.id);
      current = await this.prisma.merchantLaunchSession.findUnique({
        where: { id: current.id },
        include: { merchant: true },
      });
      if (!current) {
        return;
      }
    }
    if (
      current.offlineStatus !== LaunchSessionOfflineStatus.OFFLINE_PENDING &&
      current.offlineStatus !== LaunchSessionOfflineStatus.CALLBACK_FAILED
    ) {
      return;
    }

    const claimed = await this.launchSessionService.claimUpdateBalanceCallback(
      current.id,
    );
    if (!claimed) {
      return;
    }

    current = await this.prisma.merchantLaunchSession.findUnique({
      where: { id: current.id },
      include: { merchant: true },
    });
    if (!current || current.status !== LaunchSessionStatus.ACTIVE) {
      return;
    }
    if (
      current.offlineStatus !== LaunchSessionOfflineStatus.CALLBACK_SENDING
    ) {
      return;
    }

    const callbackResult = await this.merchantCallbackService.sendUpdateBalance(
      current.merchant,
      current,
    );
    await this.launchSessionService.markUpdateBalanceResult(
      current.id,
      callbackResult.success,
    );

    if (!callbackResult.success) {
      this.logger.warn(
        `UpdateBalance callback failed for session ${current.id}: ${callbackResult.errorMessage}`,
      );
    }
  }
}
