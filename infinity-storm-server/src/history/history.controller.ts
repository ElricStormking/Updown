import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get('bets')
  getPlayerHistory(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
  ) {
    return this.historyService.getPlayerBets(
      user.userId,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('rounds')
  getRoundHistory(@Query('limit') limit?: string) {
    return this.historyService.getRoundHistory(
      limit ? Number(limit) : undefined,
    );
  }
}
