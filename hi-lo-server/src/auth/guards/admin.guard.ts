import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAccountStatus } from '@prisma/client';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';

export type AdminContext = {
  adminId: string;
  account: string;
  merchantId: string;
  isSuperAdmin: boolean;
  source: 'admin-account' | 'legacy';
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    const adminConfig = this.configService.get<AppConfig['admin']>('admin');
    const accounts = adminConfig?.accounts ?? [];

    if (!user?.account) {
      throw new ForbiddenException('Admin access required');
    }
    if (user.type === 'admin') {
      const admin = await this.prisma.adminAccount.findUnique({
        where: { id: user.userId },
      });
      if (!admin || admin.status !== AdminAccountStatus.ENABLED) {
        throw new ForbiddenException('Admin access required');
      }
      request.adminContext = {
        adminId: admin.id,
        account: admin.account,
        merchantId: admin.merchantId,
        isSuperAdmin: admin.merchantId === 'hotcoregm',
        source: 'admin-account',
      } satisfies AdminContext;
      return true;
    }
    if (!accounts.length || !accounts.includes(user.account)) {
      throw new ForbiddenException('Admin access required');
    }
    request.adminContext = {
      adminId: user.userId,
      account: user.account,
      merchantId: 'hotcoregm',
      isSuperAdmin: true,
      source: 'legacy',
    } satisfies AdminContext;
    return true;
  }
}
