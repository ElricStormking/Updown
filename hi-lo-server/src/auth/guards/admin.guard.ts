import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const adminConfig = this.configService.get<AppConfig['admin']>('admin');
    const accounts = adminConfig?.accounts ?? [];

    if (!user?.account || !accounts.length) {
      throw new ForbiddenException('Admin access required');
    }
    if (!accounts.includes(user.account)) {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
