import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Merchant } from '@prisma/client';
import { IntegrationService } from './integration.service';
import { MerchantAuthGuard, MERCHANT_KEY } from './guards/merchant-auth.guard';
import {
  AccountCreateDto,
  TransferDto,
  GetBetHistoryDto,
  GetTransferHistoryDto,
  GetBetLimitDto,
  GetTokenValuesDto,
  LaunchGameDto,
  UpdateBetLimitDto,
  UpdateTokenValuesDto,
  AllTransferOutDto,
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
    const transferId = dto.transferId ?? dto.orderNo;
    return this.integrationService.transfer(
      merchant,
      dto.account,
      transferId,
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
      dto.playerId,
      dto.accessToken,
      dto.betLimits,
      dto.minBetAmount,
      dto.maxBetAmount,
      dto.digitBetAmountLimits,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('all-transfer-out')
  async allTransferOut(@Body() dto: AllTransferOutDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.allTransferOut(
      merchant,
      dto.account,
      dto.transferId,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/bet-limit')
  async setBetLimit(@Body() dto: UpdateBetLimitDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.setBetLimit(
      merchant,
      dto.minBetAmount,
      dto.maxBetAmount,
      dto.digitBetAmountLimits,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/bet-limit/get')
  async getBetLimit(@Body() dto: GetBetLimitDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.getBetLimit(
      merchant,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/token-values')
  async setTokenValues(@Body() dto: UpdateTokenValuesDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.setTokenValues(
      merchant,
      dto.tokenValues,
      dto.timestamp,
      dto.hash,
    );
  }

  @Post('config/token-values/get')
  async getTokenValues(@Body() dto: GetTokenValuesDto, @Req() req: any) {
    const merchant: Merchant = req[MERCHANT_KEY];
    return this.integrationService.getTokenValues(
      merchant,
      dto.timestamp,
      dto.hash,
    );
  }
}
