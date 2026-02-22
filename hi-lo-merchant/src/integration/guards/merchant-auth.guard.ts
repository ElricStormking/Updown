import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { isIP } from 'node:net';
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

    const clientIp = this.extractClientIp(request);
    const allowedIps = this.normalizeWhitelist(merchant.integrationAllowedIps);
    if (!clientIp || !allowedIps.includes(clientIp)) {
      this.logger.warn(
        `Blocked integration request for merchant=${merchant.merchantId} ip=${clientIp ?? 'unknown'} whitelist=[${allowedIps.join(',')}]`,
      );
      this.sendError(
        response,
        IntegrationErrorCodes.IP_NOT_ALLOWED,
        IntegrationErrorMessages[IntegrationErrorCodes.IP_NOT_ALLOWED],
      );
      return false;
    }

    request[MERCHANT_KEY] = merchant;
    return true;
  }

  private sendError(response: any, errorCode: number, errorMessage: string) {
    response
      .status(200)
      .json(IntegrationResponseDto.error(errorCode, errorMessage));
  }

  private normalizeWhitelist(ips: string[] | null | undefined): string[] {
    if (!ips || !ips.length) return [];
    const normalized = ips
      .map((entry) => this.normalizeIp(entry))
      .filter((entry): entry is string => Boolean(entry));
    return Array.from(new Set(normalized));
  }

  private extractClientIp(request: any): string | null {
    const candidates: string[] = [];

    const forwardedFor = request?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      candidates.push(forwardedFor.split(',')[0] ?? '');
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      const first = forwardedFor[0];
      if (typeof first === 'string' && first.trim()) {
        candidates.push(first.split(',')[0] ?? '');
      }
    }

    const realIp = request?.headers?.['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      candidates.push(realIp);
    }

    candidates.push(
      request?.ip ?? '',
      request?.socket?.remoteAddress ?? '',
      request?.connection?.remoteAddress ?? '',
    );

    for (const candidate of candidates) {
      const normalized = this.normalizeIp(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  private normalizeIp(value: string): string | null {
    let ip = value.trim();
    if (!ip) return null;

    const commaIndex = ip.indexOf(',');
    if (commaIndex >= 0) {
      ip = ip.slice(0, commaIndex).trim();
    }

    if (ip.startsWith('[') && ip.includes(']')) {
      ip = ip.slice(1, ip.indexOf(']')).trim();
    }

    if (ip.toLowerCase().startsWith('::ffff:')) {
      ip = ip.slice(7);
    }

    const zoneIndex = ip.indexOf('%');
    if (zoneIndex >= 0) {
      ip = ip.slice(0, zoneIndex);
    }

    const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
    if (ipv4WithPort) {
      ip = ipv4WithPort[1];
    }

    const version = isIP(ip);
    if (!version) return null;

    return version === 6 ? ip.toLowerCase() : ip;
  }
}
