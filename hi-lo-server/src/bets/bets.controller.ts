import { Body, Controller, Delete, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { BetsService } from './bets.service';
import { PlaceBetDto } from './dto/place-bet.dto';

@UseGuards(JwtAuthGuard)
@Controller('bets')
export class BetsController {
  constructor(private readonly betsService: BetsService) {}

  @Post()
  async placeBet(@CurrentUser() user: AuthUser, @Body() dto: PlaceBetDto) {
    const result = await this.betsService.placeBet(user.userId, dto);
    return {
      bet: {
        id: result.bet.id,
        roundId: result.bet.roundId,
        betType: result.bet.betType,
        side: result.bet.side,
        digitType: result.bet.digitType,
        selection: result.bet.selection,
        amount: Number(result.bet.amount),
        odds: Number(result.bet.odds),
        createdAt: result.bet.createdAt,
      },
      walletBalance: Number(result.walletBalance),
    };
  }

  @Delete('round/:roundId')
  async clearRoundBets(
    @CurrentUser() user: AuthUser,
    @Param('roundId', ParseIntPipe) roundId: number,
  ) {
    const result = await this.betsService.clearBetsForRound(user.userId, roundId);
    return {
      roundId: result.roundId,
      cleared: result.cleared,
      refundedAmount: Number(result.refundedAmount),
      walletBalance: Number(result.walletBalance),
    };
  }
}
