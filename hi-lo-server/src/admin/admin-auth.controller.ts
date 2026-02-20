import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
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
  @UseGuards(JwtAuthGuard, AdminGuard)
  async register(
    @Body() dto: AdminRegisterDto,
    @Req()
    request?: { adminContext?: AdminContext },
  ) {
    if (!request?.adminContext?.isSuperAdmin) {
      throw new ForbiddenException('Only superadmin can create admin accounts');
    }
    const admin = await this.accountsService.createAccount({
      account: dto.account,
      password: dto.password,
      merchantId: dto.merchantId,
    });
    return this.buildAuthResponse(admin);
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
}
