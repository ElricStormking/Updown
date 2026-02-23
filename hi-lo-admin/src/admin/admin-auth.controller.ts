import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import type { AdminContext } from '../auth/guards/admin.guard';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminLoginDto, AdminRegisterDto } from './dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly accountsService: AdminAccountsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig>,
  ) {}

  @Post('login')
  async login(@Body() dto: AdminLoginDto) {
    const admin = await this.accountsService.validateAdminLogin(
      dto.account,
      dto.password,
    );
    return this.buildAuthResponse(admin);
  }

  @Post('register')
  async register(
    @Body() dto: AdminRegisterDto,
    @Req()
    request?: {
      headers?: {
        authorization?: string | string[];
      };
    },
  ) {
    const bearerToken = this.extractBearerToken(
      request?.headers?.authorization,
    );
    if (!bearerToken) {
      return this.registerBootstrap(dto);
    }

    const requesterAdmin = await this.resolveRequesterAdmin(bearerToken);
    if (!requesterAdmin.isSuperAdmin) {
      throw new ForbiddenException('Only superadmin can create admin accounts');
    }
    const admin = await this.accountsService.createAccount({
      account: dto.account,
      password: dto.password,
      merchantId: dto.merchantId,
      isSuperadminCreate: dto.isSuperadminCreate,
    });
    return { created: admin };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('me')
  me(@Req() request: { adminContext?: AdminContext }) {
    const adminContext = request.adminContext;
    if (!adminContext) {
      return { user: null };
    }
    return {
      user: {
        account: adminContext.account,
        merchantId: adminContext.merchantId,
        isAdmin: true,
        isSuperAdmin: adminContext.isSuperAdmin,
      },
    };
  }

  @Get('bootstrap-status')
  async bootstrapStatus() {
    const hasSuperAdmin = await this.accountsService.hasSuperAdminAccount();
    return {
      canBootstrap: !hasSuperAdmin,
      requiredMerchantId: 'hotcoregm',
    };
  }

  private async buildAuthResponse(admin: {
    id: string;
    account: string;
    merchantId: string;
  }) {
    const payload: JwtPayload = {
      sub: admin.id,
      account: admin.account,
      type: 'admin',
      merchantId: admin.merchantId,
    };
    const authConfig = this.configService.get<AppConfig['auth']>('auth');
    const expiresInRaw = authConfig?.jwtExpiresIn ?? '1h';
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresInRaw as any,
    });
    return {
      accessToken,
      user: {
        id: admin.id,
        account: admin.account,
        merchantId: admin.merchantId,
        isAdmin: true,
        isSuperAdmin: admin.merchantId === 'hotcoregm',
      },
    };
  }

  private async registerBootstrap(dto: AdminRegisterDto) {
    if (dto.merchantId !== 'hotcoregm') {
      throw new ForbiddenException(
        'First superadmin bootstrap must use merchantId=hotcoregm',
      );
    }
    const hasSuperAdmin = await this.accountsService.hasSuperAdminAccount();
    if (hasSuperAdmin) {
      throw new ForbiddenException(
        'Superadmin already exists. Login as superadmin to create admin accounts.',
      );
    }
    const admin = await this.accountsService.createAccount({
      account: dto.account,
      password: dto.password,
      merchantId: dto.merchantId,
      isSuperadminCreate: true,
    });
    return this.buildAuthResponse(admin);
  }

  private extractBearerToken(
    authorizationHeader: string | string[] | undefined,
  ) {
    if (!authorizationHeader) {
      return '';
    }
    const raw = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;
    const [scheme, token] = raw.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return '';
    }
    return token.trim();
  }

  private async resolveRequesterAdmin(token: string) {
    const secret =
      this.configService.get<AppConfig['auth']>('auth')?.jwtSecret ??
      'change-me';

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin token');
    }

    if (payload.type !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    const admin = await this.accountsService.getActiveAccountById(payload.sub);
    if (!admin) {
      throw new UnauthorizedException('Admin access required');
    }

    return {
      id: admin.id,
      isSuperAdmin: admin.merchantId === 'hotcoregm',
    };
  }
}
