import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { LaunchSessionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { LaunchSessionStartResponseDto } from './dto';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';
import {
  IntegrationErrorCodes,
  IntegrationErrorMessages,
} from './utils/error-codes';

type AuthenticatedLaunchUser = {
  userId: string;
  merchantId?: string;
  launchSessionId?: string;
  launchMode?: 'legacy' | 'callback';
};

@Controller('integration/launch/session')
@UseGuards(JwtAuthGuard)
export class IntegrationLaunchSessionController {
  constructor(
    private readonly launchSessionService: LaunchSessionService,
    private readonly merchantCallbackService: MerchantCallbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('start')
  async startSession(@Req() req: any): Promise<LaunchSessionStartResponseDto> {
    const user = req.user as AuthenticatedLaunchUser | undefined;
    const launchMode = user?.launchMode;
    const launchSessionId = user?.launchSessionId;
    const merchantId = user?.merchantId ?? '';
    const userId = user?.userId ?? '';

    if (!launchSessionId || launchMode !== 'callback') {
      return {
        ready: true,
        mode: 'legacy',
        code: IntegrationErrorCodes.SUCCESS,
        message: '',
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
        code: IntegrationErrorCodes.LAUNCH_SESSION_NOT_FOUND,
        message:
          IntegrationErrorMessages[
            IntegrationErrorCodes.LAUNCH_SESSION_NOT_FOUND
          ],
      };
    }

    if (session.status !== LaunchSessionStatus.ACTIVE) {
      return {
        ready: false,
        mode: 'callback',
        code: IntegrationErrorCodes.LAUNCH_SESSION_NOT_ACTIVE,
        message:
          IntegrationErrorMessages[
            IntegrationErrorCodes.LAUNCH_SESSION_NOT_ACTIVE
          ],
      };
    }

    if (session.loginStatus === 'VERIFIED') {
      return {
        ready: true,
        mode: 'callback',
        code: IntegrationErrorCodes.SUCCESS,
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
        code: IntegrationErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED,
        message:
          IntegrationErrorMessages[
            IntegrationErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED
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
        code: IntegrationErrorCodes.LOGIN_PLAYER_CALLBACK_FAILED,
        message: callbackResult.errorMessage,
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
      code: IntegrationErrorCodes.SUCCESS,
      message: '',
    };
  }
}
