import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Ensure we always pass a string, not string | undefined, to satisfy typings
      secretOrKey: configService.get<string>('auth.jwtSecret') ?? 'change-me',
    });
  }

  async validate(payload: JwtPayload) {
    let merchantId = payload.merchantId;

    if (payload.type !== 'admin') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true, merchantId: true },
      });
      if (!user || user.status === UserStatus.DISABLED) {
        throw new UnauthorizedException('Account is disabled');
      }
      if (!user.merchantId) {
        throw new UnauthorizedException('Account is not assigned to a merchant');
      }
      if (payload.merchantId && payload.merchantId !== user.merchantId) {
        throw new UnauthorizedException('Invalid token merchant context');
      }
      merchantId = user.merchantId;
    }

    return {
      userId: payload.sub,
      account: payload.account,
      type: payload.type,
      merchantId,
    };
  }
}
