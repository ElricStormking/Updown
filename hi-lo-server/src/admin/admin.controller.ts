import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
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

const ADMIN_PAGE_RELATIVE_PATH = ['hi-lo-admin', 'admin-page.html'];
const ADMIN_PAGE_CANDIDATES = [
  path.resolve(process.cwd(), '..', ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(process.cwd(), ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(__dirname, '..', '..', ...ADMIN_PAGE_RELATIVE_PATH),
  path.resolve(__dirname, '..', '..', '..', ...ADMIN_PAGE_RELATIVE_PATH),
];

let adminPageHtmlCache: string | null = null;
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
  if (adminPageHtmlCache) return adminPageHtmlCache;
  const filePath = resolveAdminPagePath();
  if (!filePath) {
    throw new NotFoundException('Admin page not found');
  }
  adminPageHtmlCache = await readFile(filePath, 'utf8');
  return adminPageHtmlCache;
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
  getDailyRtp(@Query('start') start?: string, @Query('end') end?: string) {
    return this.statsService.getDailyRtp(start, end);
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
  queryBets(@Query() dto: QueryBetsDto) {
    return this.dataService.queryBets(dto);
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
  queryPlayers(@Query() dto: QueryPlayersDto) {
    return this.dataService.queryPlayers(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('players/:id/status')
  updatePlayerStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePlayerStatusDto,
  ) {
    return this.dataService.updatePlayerStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('players/logins')
  queryPlayerLogins(@Query() dto: QueryPlayerLoginsDto) {
    return this.dataService.queryPlayerLogins(dto);
  }

  // Merchant Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants')
  queryMerchants(@Query() dto: QueryMerchantsDto) {
    return this.dataService.queryMerchants(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('merchants')
  createMerchant(@Body() dto: CreateMerchantDto) {
    return this.dataService.createMerchant(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('merchants/:id')
  getMerchant(@Param('id') id: string) {
    return this.dataService.getMerchantById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('merchants/:id')
  updateMerchant(@Param('id') id: string, @Body() dto: UpdateMerchantDto) {
    return this.dataService.updateMerchant(id, dto);
  }

  // Financial Management - Transfers
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transfers')
  queryTransfers(@Query() dto: QueryTransfersDto) {
    return this.dataService.queryTransfers(dto);
  }

  // Financial Management - Wallet Transactions
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('transactions')
  queryTransactions(@Query() dto: QueryTransactionsDto) {
    return this.dataService.queryTransactions(dto);
  }

  // Admin Account Management
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts')
  queryAdminAccounts(@Query() dto: QueryAdminAccountsDto) {
    return this.accountsService.queryAccounts(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('accounts')
  createAdminAccount(@Body() dto: CreateAdminAccountDto) {
    return this.accountsService.createAccount(dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/:id')
  getAdminAccount(@Param('id') id: string) {
    return this.accountsService.getAccountById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('accounts/:id')
  updateAdminAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAdminAccountDto,
  ) {
    return this.accountsService.updateAccount(id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('accounts/login-records')
  queryAdminLoginRecords(@Query() dto: QueryLoginRecordsDto) {
    return this.accountsService.queryLoginRecords(dto);
  }
}
