import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Merchant } from '@prisma/client';
import { IntegrationService } from './integration.service';
import { MerchantAuthGuard, MERCHANT_KEY } from './guards/merchant-auth.guard';
import {
  AccountCreateDto,
  TransferDto,
  GetBetHistoryDto,
  GetTransferHistoryDto,
  LaunchGameDto,
  UpdateBetLimitDto,
  UpdateTokenValuesDto,
} from './dto';

@Controller('integration')
@UseGuards(MerchantAuthGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('account/create')
  async createAccount(@Body() dto: AccountCreateDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.createAccount(
      merchant,
      dto.account,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('transfer')
  async transfer(@Body() dto: TransferDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.transfer(
      merchant,
      dto.account,
      dto.orderNo,
      dto.type,
      dto.amount,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('bets')
  async getBetHistory(@Body() dto: GetBetHistoryDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.getBetHistory(
      merchant,
      dto.startBetTime,
      dto.pageSize,
      dto.pageNumber,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('transfers')
  async getTransferHistory(
    @Body() dto: GetTransferHistoryDto,
    @Req() req: any,
  ) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.getTransferHistory(
      merchant,
      dto.startTime,
      dto.pageSize,
      dto.pageNumber,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('launch')
  async launchGame(@Body() dto: LaunchGameDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.launchGame(
      merchant,
      dto.account,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/bet-limit')
  async updateBetLimit(@Body() dto: UpdateBetLimitDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.updateBetLimit(
      merchant,
      dto.maxBetAmount,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/token-values')
  async updateTokenValues(@Body() dto: UpdateTokenValuesDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.updateTokenValues(
      merchant,
      dto.tokenValues,
      dto.timestamp,
      dto.hash,
    );
  }
}
