import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class SlidingJwtInterceptor implements NestInterceptor {
  private static readonly REFRESH_HEADER = 'x-access-token';

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const refreshed = this.buildRefreshedToken(request.user);
        if (refreshed) {
          response.setHeader(SlidingJwtInterceptor.REFRESH_HEADER, refreshed);
        }
      }),
    );
  }

  private buildRefreshedToken(user?: AuthUser): string | null {
    if (!user || user.type === 'admin') {
      return null;
    }

    const merchantId =
      typeof user.merchantId === 'string' ? user.merchantId.trim() : '';
    if (!merchantId) {
      return null;
    }

    const payload: JwtPayload = {
      sub: user.userId,
      account: user.account,
      type: 'user',
      merchantId,
      launchSessionId: user.launchSessionId,
      launchMode: user.launchMode,
    };

    const secret = this.configService.get<string>('auth.jwtSecret') ?? 'change-me';
    const expiresIn = (this.configService.get<string>('auth.jwtExpiresIn') ??
      '1h') as any;

    return this.jwtService.sign(payload, {
      secret,
      expiresIn,
    });
  }
}
