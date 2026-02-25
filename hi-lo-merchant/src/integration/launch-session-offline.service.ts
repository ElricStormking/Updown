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
      const sessions = await this.findSessionsEligibleForOfflineCallback();
      for (const session of sessions) {
        await this.processSession(session);
      }
    } catch (error) {
      this.logger.error('Offline launch-session sweep failed', error as Error);
    } finally {
      this.sweepInProgress = false;
    }
  }

  private async findSessionsEligibleForOfflineCallback(): Promise<
    LaunchSessionWithMerchant[]
  > {
    const offlineGraceMs =
      this.configService.get<number>('integration.offlineGraceMs') ?? 30000;
    const cutoff = new Date(Date.now() - offlineGraceMs);

    return this.prisma.merchantLaunchSession.findMany({
      where: {
        status: LaunchSessionStatus.ACTIVE,
        loginStatus: LaunchSessionLoginStatus.VERIFIED,
        OR: [
          {
            offlineStatus: LaunchSessionOfflineStatus.ONLINE,
            expiresAt: {
              lte: cutoff,
            },
          },
          {
            offlineStatus: LaunchSessionOfflineStatus.OFFLINE_PENDING,
            updatedAt: {
              lte: cutoff,
            },
          },
          {
            offlineStatus: LaunchSessionOfflineStatus.CALLBACK_FAILED,
            updatedAt: {
              lte: cutoff,
            },
          },
        ],
      },
      include: {
        merchant: true,
      },
      orderBy: {
        expiresAt: 'asc',
      },
      take: OFFLINE_SWEEP_BATCH_SIZE,
    });
  }

  private async processSession(session: LaunchSessionWithMerchant): Promise<void> {
    if (
      session.offlineStatus === LaunchSessionOfflineStatus.ONLINE ||
      session.offlineStatus === LaunchSessionOfflineStatus.CALLBACK_FAILED
    ) {
      await this.launchSessionService.markOfflinePending(session.id);
    }

    const current = await this.prisma.merchantLaunchSession.findUnique({
      where: { id: session.id },
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
    if (
      current.offlineStatus !== LaunchSessionOfflineStatus.OFFLINE_PENDING &&
      current.offlineStatus !== LaunchSessionOfflineStatus.CALLBACK_FAILED
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
