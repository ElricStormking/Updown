import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminStatsService } from './admin-stats.service';
import { AdminDataService } from './admin-data.service';
import { AdminAccountsService } from './admin-accounts.service';
import {
  QueryRoundsDto,
  QueryBetsDto,
  QueryPlayersDto,
  UpdatePlayerStatusDto,
  QueryTransfersDto,
  QueryTransactionsDto,
  QueryMerchantsDto,
  CreateMerchantDto,
  UpdateMerchantDto,
  QueryPriceSnapshotsDto,
  QueryPlayerLoginsDto,
  QueryAdminAccountsDto,
  CreateAdminAccountDto,
  UpdateAdminAccountDto,
  QueryLoginRecordsDto,
} from './dto';
import type { AdminContext } from '../auth/guards/admin.guard';

const ADMIN_PAGE_RELATIVE_PATH = ['hi-lo-admin', 'admin-page.html'];
const ADMIN_PAGE_CANDIDATES = [
  path.resolve(process.cwd(), '..', ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(process.cwd(), ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(__dirname, '..', '..', ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(__dirname, '..', '..', '..', ...ADMIN_PAGE_RELATIVE_PATH),
];

let adminPagePathCache: string | null = null;

const resolveAdminPagePath = () => {
  if (adminPagePathCache) return adminPagePathCache;
  for (const candidate of ADMIN_PAGE_CANDIDATES) {
    if (existsSync(candidate)) {
      adminPagePathCache = candidate;
      return candidate;
    }
  }
            return null;
};

const loadAdminPageHtml = async () => {
  const filePath = resolveAdminPagePath();
  if (!filePath) {
    throw new NotFoundException('Admin page not found');
  }
  return readFile(filePath, 'utf8');
};

@Controller('admin')
export class AdminController {
  constructor(
    private readonly statsService: AdminStatsService,
    private readonly dataService: AdminDataService,
    private readonly accountsService: AdminAccountsService,
  ) {}

  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  async getAdminPage() {
    return loadAdminPageHtml();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats/daily-rtp')
  getDailyRtp(
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.statsService.getDailyRtp(
      start,
      end,
      this.resolveMerchantScope(request),
    );
  }

  // Game Management - Rounds
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('rounds')
  queryRounds(@Query() dto: QueryRoundsDto) {
    return this.dataService.queryRounds(dto);
  }

  // Game Management - Bets
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('bets')
  queryBets(@Query() dto: QueryBetsDto, @Req() request?: { adminContext?: AdminContext }) {
    return this.dataService.queryBets(dto, this.resolveMerchantScope(request));
  }

  // Game Management - Price Snapshots
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('price-snapshots')
  queryPriceSnapshots(@Query() dto: QueryPriceSnapshotsDto) {
    return this.dataService.queryPriceSnapshots(dto);
  }

  // Player Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('players')
  queryPlayers(
    @Query() dto: QueryPlayersDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.queryPlayers(dto, this.resolveMerchantScope(request));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('players/:id/status')
  updatePlayerStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlayerStatusDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.updatePlayerStatus(
      id,
      dto.status,
      this.resolveMerchantScope(request),
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('players/logins')
  queryPlayerLogins(
    @Query() dto: QueryPlayerLoginsDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.queryPlayerLogins(
      dto,
      this.resolveMerchantScope(request),
    );
  }

  // Merchant Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants')
  queryMerchants(
    @Query() dto: QueryMerchantsDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.queryMerchants(dto, this.resolveMerchantScope(request));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('merchants')
  createMerchant(
    @Body() dto: CreateMerchantDto,
    @Req()
    request?: {
      adminContext?: { merchantId: string; isSuperAdmin: boolean };
    },
  ) {
    if (!request?.adminContext?.isSuperAdmin) {
      throw new ForbiddenException(
        'Only superadmin can create new merchant IDs',
      );
    }
    return this.dataService.createMerchant(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants/:id')
  getMerchant(
    @Param('id') id: string,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.getMerchantById(id, this.resolveMerchantScope(request));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('merchants/:id')
  updateMerchant(
    @Param('id') id: string,
    @Body() dto: UpdateMerchantDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.updateMerchant(
      id,
      dto,
      this.resolveMerchantScope(request),
    );
  }

  // Financial Management - Transfers
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transfers')
  queryTransfers(
    @Query() dto: QueryTransfersDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.queryTransfers(
      dto,
      this.resolveMerchantScope(request),
    );
  }

  // Financial Management - Wallet Transactions
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transactions')
  queryTransactions(
    @Query() dto: QueryTransactionsDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.dataService.queryTransactions(
      dto,
      this.resolveMerchantScope(request),
    );
  }

  // Admin Account Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts')
  queryAdminAccounts(
    @Query() dto: QueryAdminAccountsDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.accountsService.queryAccounts(dto, this.resolveAdminScope(request));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/login-records')
  queryAdminLoginRecords(
    @Query() dto: QueryLoginRecordsDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.accountsService.queryLoginRecords(
      dto,
      this.resolveAdminScope(request),
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('accounts')
  createAdminAccount(
    @Body() dto: CreateAdminAccountDto,
    @Req()
    request?: {
      adminContext?: { merchantId: string; isSuperAdmin: boolean };
    },
  ) {
    if (!request?.adminContext?.isSuperAdmin) {
      throw new ForbiddenException(
        'Only superadmin can create admin accounts',
      );
    }
    return this.accountsService.createAccount(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/:id')
  getAdminAccount(
    @Param('id') id: string,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.accountsService.getAccountById(id, this.resolveAdminScope(request));
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('accounts/:id')
  updateAdminAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAdminAccountDto,
    @Req() request?: { adminContext?: AdminContext },
  ) {
    return this.accountsService.updateAccount(
      id,
      dto,
      this.resolveAdminScope(request),
    );
  }

  private resolveMerchantScope(request?: { adminContext?: AdminContext }) {
    const adminContext = request?.adminContext;
    if (!adminContext || adminContext.isSuperAdmin) {
      return undefined;
    }
    return adminContext.merchantId;
  }

  private resolveAdminScope(request?: { adminContext?: AdminContext }) {
    return request?.adminContext;
  }
}
