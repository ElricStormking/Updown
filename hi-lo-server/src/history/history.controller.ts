import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
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

  @UseGuards(JwtAuthGuard)
  @Get('bets/paged')
  getPlayerHistoryPaged(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.historyService.getPlayerBetsPaged(
      user.userId,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('bets/round/:roundId')
  getPlayerBetsForRound(
    @CurrentUser() user: AuthUser,
    @Param('roundId', ParseIntPipe) roundId: number,
  ) {
    return this.historyService.getPlayerBetsForRound(user.userId, roundId);
  }

  @Get('rounds')
  getRoundHistory(@Query('limit') limit?: string) {
    return this.historyService.getRoundHistory(
      limit ? Number(limit) : undefined,
    );
  }
}
