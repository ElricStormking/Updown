import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { LaunchSessionOfflineStatus, LaunchSessionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';

type LaunchSessionMode = 'callback';

type LaunchSessionStartResponse = {
  ready: boolean;
  mode: LaunchSessionMode;
  code: number;
  message: string;
};

type AuthenticatedLaunchUser = {
  userId: string;
  merchantId?: string;
  launchSessionId?: string;
  launchMode?: LaunchSessionMode;
};

const LaunchSessionErrorCodes = {
  SUCCESS: 0,
  CALLBACK_MERCHANT_NOT_CONFIGURED: 6002,
  LAUNCH_SESSION_NOT_FOUND: 6003,
  LAUNCH_SESSION_NOT_ACTIVE: 6004,
  LOGIN_PLAYER_CALLBACK_FAILED: 6005,
  UPDATE_BALANCE_CALLBACK_FAILED: 6006,
} as const;

const LaunchSessionErrorMessages: Record<number, string> = {
  [LaunchSessionErrorCodes.SUCCESS]: '',
  [LaunchSessionErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED]:
    'Merchant callback mode is not configured',
  [LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_FOUND]: 'Launch session not found',
  [LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_ACTIVE]:
    'Launch session is not active',
  [LaunchSessionErrorCodes.LOGIN_PLAYER_CALLBACK_FAILED]:
    'LoginPlayer callback failed',
  [LaunchSessionErrorCodes.UPDATE_BALANCE_CALLBACK_FAILED]:
    'UpdateBalance callback failed',
};

@Controller('integration/launch/session')
@UseGuards(JwtAuthGuard)
export class LaunchSessionController {
  constructor(
    private readonly launchSessionService: LaunchSessionService,
    private readonly merchantCallbackService: MerchantCallbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('start')
  async startSession(
    @Req() req: { user?: AuthenticatedLaunchUser },
  ): Promise<LaunchSessionStartResponse> {
    const user = req.user;
    const launchMode = user?.launchMode;
    const launchSessionId = user?.launchSessionId;
    const merchantId = user?.merchantId ?? '';
    const userId = user?.userId ?? '';

    if (!launchSessionId || launchMode !== 'callback') {
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_FOUND,
        message: 'Launch URL is missing callback session metadata',
      };
    }

    const session = await this.launchSessionService.getLaunchSessionForUser(
      launchSessionId,
      userId,
      merchantId,
    );
    if (!session) {
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_FOUND,
        message:
          LaunchSessionErrorMessages[
            LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_FOUND
          ],
      };
    }

    if (session.status !== LaunchSessionStatus.ACTIVE) {
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_ACTIVE,
        message:
          LaunchSessionErrorMessages[
            LaunchSessionErrorCodes.LAUNCH_SESSION_NOT_ACTIVE
          ],
      };
    }

    if (session.offlineStatus === LaunchSessionOfflineStatus.CALLBACK_FAILED) {
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.UPDATE_BALANCE_CALLBACK_FAILED,
        message:
          LaunchSessionErrorMessages[
            LaunchSessionErrorCodes.UPDATE_BALANCE_CALLBACK_FAILED
          ],
      };
    }

    if (session.loginStatus === 'VERIFIED') {
      return {
        ready: true,
        mode: 'callback',
        code: LaunchSessionErrorCodes.SUCCESS,
        message: '',
      };
    }

    if (
      !session.merchant.callbackEnabled ||
      !session.merchant.loginPlayerCallbackUrl
    ) {
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED,
        message:
          LaunchSessionErrorMessages[
            LaunchSessionErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED
          ],
      };
    }

    const callbackResult = await this.merchantCallbackService.sendLoginPlayer(
      session.merchant,
      session,
    );
    if (!callbackResult.success) {
      await this.launchSessionService.markLoginFailed(session.id);
      return {
        ready: false,
        mode: 'callback',
        code: LaunchSessionErrorCodes.LOGIN_PLAYER_CALLBACK_FAILED,
        message:
          callbackResult.errorMessage ||
          LaunchSessionErrorMessages[
            LaunchSessionErrorCodes.LOGIN_PLAYER_CALLBACK_FAILED
          ],
      };
    }

    await this.launchSessionService.markLoginVerified(session.id);
    await this.prisma.playerLogin.create({
      data: {
        merchantId: session.merchantId,
        userId: session.userId,
      },
    });

    return {
      ready: true,
      mode: 'callback',
      code: LaunchSessionErrorCodes.SUCCESS,
      message: '',
    };
  }
}
