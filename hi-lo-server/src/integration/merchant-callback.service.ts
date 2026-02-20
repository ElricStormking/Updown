import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Merchant, MerchantLaunchSession } from '@prisma/client';
import { generateSignature } from './utils/signature.utils';

type CallbackResult = {
  success: boolean;
  errorMessage: string;
};

@Injectable()
export class MerchantCallbackService {
  private readonly logger = new Logger(MerchantCallbackService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendLoginPlayer(
    merchant: Merchant,
    session: MerchantLaunchSession,
  ): Promise<CallbackResult> {
    if (!merchant.loginPlayerCallbackUrl) {
      return {
        success: false,
        errorMessage: 'Missing LoginPlayer callback URL',
      };
    }
    return this.sendCallback(
      merchant,
      merchant.loginPlayerCallbackUrl,
      session,
      'LoginPlayer',
    );
  }

  async sendUpdateBalance(
    merchant: Merchant,
    session: MerchantLaunchSession,
  ): Promise<CallbackResult> {
    if (!merchant.updateBalanceCallbackUrl) {
      return {
        success: false,
        errorMessage: 'Missing UpdateBalance callback URL',
      };
    }
    return this.sendCallback(
      merchant,
      merchant.updateBalanceCallbackUrl,
      session,
      'UpdateBalance',
    );
  }

  private async sendCallback(
    merchant: Merchant,
    url: string,
    session: MerchantLaunchSession,
    callbackName: 'LoginPlayer' | 'UpdateBalance',
  ): Promise<CallbackResult> {
    const timeoutMs =
      this.configService.get<number>('integration.callbackTimeoutMs') ?? 5000;
    const retryCount =
      this.configService.get<number>('integration.callbackRetryCount') ?? 2;
    const attempts = retryCount + 1;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const timestamp = Math.floor(Date.now() / 1000);
      const hash = generateSignature(
        [merchant.merchantId, timestamp.toString()],
        merchant.hashKey,
      );

      const payload = {
        merchantId: merchant.merchantId,
        playerId: session.playerId,
        account: session.account,
        accessToken: session.merchantAccessToken,
        currency: session.currency,
        timestamp,
        hash,
      };

      const result = await this.postJson(url, payload, timeoutMs);
      if (result.success) {
        return result;
      }

      this.logger.warn(
        `${callbackName} callback attempt ${attempt}/${attempts} failed for merchant=${merchant.merchantId} session=${session.id}: ${result.errorMessage}`,
      );
    }

    return {
      success: false,
      errorMessage: `${callbackName} callback failed after retries`,
    };
  }

  private async postJson(
    url: string,
    payload: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<CallbackResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let body: any = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        return {
          success: false,
          errorMessage: `HTTP ${response.status}`,
        };
      }

      if (body?.success === true) {
        return {
          success: true,
          errorMessage: '',
        };
      }

      return {
        success: false,
        errorMessage:
          typeof body?.errorMessage === 'string'
            ? body.errorMessage
            : 'Callback response was not successful',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          errorMessage: 'Callback timeout',
        };
      }
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Unknown callback error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
