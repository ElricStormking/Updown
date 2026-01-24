import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { validateTimestamp } from '../utils/signature.utils';
import {
  IntegrationErrorCodes,
  IntegrationErrorMessages,
} from '../utils/error-codes';
import { IntegrationResponseDto } from '../dto/integration-response.dto';

export const MERCHANT_KEY = 'merchant';

@Injectable()
export class MerchantAuthGuard implements CanActivate {
  private readonly logger = new Logger(MerchantAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const body = request.body;

    const merchantId = body?.merchantId;
    const timestamp = body?.timestamp;

    if (!merchantId) {
      this.sendError(
        response,
        IntegrationErrorCodes.MERCHANT_NOT_FOUND,
        IntegrationErrorMessages[IntegrationErrorCodes.MERCHANT_NOT_FOUND],
      );
      return false;
    }

    const toleranceSec = this.configService.get<number>(
      'integration.timestampToleranceSec',
      10,
    );

    if (!timestamp || !validateTimestamp(timestamp, toleranceSec)) {
      this.sendError(
        response,
        IntegrationErrorCodes.TIMESTAMP_EXPIRED,
        IntegrationErrorMessages[IntegrationErrorCodes.TIMESTAMP_EXPIRED],
      );
      return false;
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { merchantId },
    });

    if (!merchant) {
      this.sendError(
        response,
        IntegrationErrorCodes.MERCHANT_NOT_FOUND,
        IntegrationErrorMessages[IntegrationErrorCodes.MERCHANT_NOT_FOUND],
      );
      return false;
    }

    if (!merchant.isActive) {
      this.sendError(
        response,
        IntegrationErrorCodes.MERCHANT_INACTIVE,
        IntegrationErrorMessages[IntegrationErrorCodes.MERCHANT_INACTIVE],
      );
      return false;
    }

    request[MERCHANT_KEY] = merchant;
    return true;
  }

  private sendError(response: any, errorCode: number, errorMessage: string) {
    response.status(200).json(IntegrationResponseDto.error(errorCode, errorMessage));
  }
}
