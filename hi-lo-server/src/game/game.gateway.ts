import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { BinancePriceService } from '../binance/binance.service';
import { RoundEngineService } from './round-engine.service';
import { PlaceBetDto } from '../bets/dto/place-bet.dto';
import { BetsService } from '../bets/bets.service';
import { WalletService } from '../wallet/wallet.service';
import { ClientReadyDto } from './dto/client-ready.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RoundStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundEvent } from './interfaces/round-event.interface';

@Injectable()
@WebSocketGateway({
  namespace: 'game',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway
  implements
    OnModuleInit,
    OnModuleDestroy,
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(GameGateway.name);
  private priceSub?: Subscription;
  private roundSub?: Subscription;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly binancePrice: BinancePriceService,
    private readonly roundEngine: RoundEngineService,
    private readonly betsService: BetsService,
    private readonly walletService: WalletService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.priceSub = this.binancePrice.price$().subscribe((update) => {
      this.server.emit('price:update', update);
    });

    this.roundSub = this.roundEngine.events$().subscribe((event) => {
      void this.handleRoundEvent(event);
    });
  }

  onModuleDestroy() {
    this.priceSub?.unsubscribe();
    this.roundSub?.unsubscribe();
  }

  async handleConnection(client: Socket) {
    const currentRound = this.roundEngine.getCurrentRound();
    if (currentRound) {
      client.emit('round:start', currentRound);
      if (currentRound.status !== RoundStatus.BETTING) {
        client.emit('round:locked', {
          roundId: currentRound.id,
          lockedPrice: currentRound.lockedPrice ?? null,
          digitBonus: currentRound.digitBonus,
        });
      }
    }

    const latestPrice = await this.binancePrice.getLatestPrice();
    if (latestPrice) {
      client.emit('price:update', latestPrice);
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      client.leave(this.getUserRoom(client.data.userId));
    }
  }

  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  )
  @SubscribeMessage('client:ready')
  async handleClientReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ClientReadyDto,
  ) {
    try {
      const payload = await this.verifyToken(body.token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, merchantId: true },
      });
      if (!user || user.status === UserStatus.DISABLED) {
        throw new UnauthorizedException('Account is disabled');
      }
      if (!user.merchantId) {
        throw new UnauthorizedException('Account is not assigned to a merchant');
      }

      client.data.userId = user.id;
      await client.join(this.getUserRoom(user.id));
      const wallet = await this.walletService.getOrCreateWallet(user.id);

      client.emit('balance:update', {
        balance: Number(wallet.balance),
      });

      return {
        status: 'ok',
        userId: user.id,
        account: payload.account,
      };
    } catch (error) {
      this.logger.warn(`client:ready failed: ${error}`);
      throw error;
    }
  }

  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  )
  @SubscribeMessage('bet:place')
  async handleBetPlace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PlaceBetDto,
  ) {
    this.ensureAuthenticated(client);
    try {
      const result = await this.betsService.placeBet(client.data.userId, body);
      const serializedBet = {
        id: result.bet.id,
        roundId: result.bet.roundId,
        betType: result.bet.betType,
        side: result.bet.side,
        digitType: result.bet.digitType,
        selection: result.bet.selection,
        amount: Number(result.bet.amount),
        odds: Number(result.bet.odds),
        createdAt: result.bet.createdAt,
      };

      this.server.to(this.getUserRoom(client.data.userId)).emit('bet:placed', {
        bet: serializedBet,
      });
      this.server
        .to(this.getUserRoom(client.data.userId))
        .emit('balance:update', {
          balance: Number(result.walletBalance),
        });

      return { status: 'ok', bet: serializedBet };
    } catch (error) {
      const message = this.unwrapError(error);
      this.logger.warn(`bet:place error: ${message}`);
      throw new BadRequestException(message);
    }
  }

  private ensureAuthenticated(client: Socket) {
    if (!client.data.userId) {
      throw new UnauthorizedException('Authenticate with client:ready first');
    }
  }

  private getUserRoom(userId: string) {
    return `user:${userId}`;
  }

  private async verifyToken(token: string) {
    const secret = this.configService.getOrThrow<string>('auth.jwtSecret');
    return this.jwtService.verifyAsync<JwtPayload>(token, { secret });
  }

  private unwrapError(error: unknown) {
    if (error instanceof BadRequestException || error instanceof Error) {
      return error.message;
    }
    return 'Unexpected error';
  }

  private async handleRoundEvent(event: RoundEvent) {
    if (event.type !== 'round:result') {
      this.server.emit(event.type, event.payload);
      return;
    }

    const { balanceUpdates, participants, ...publicStats } =
      event.payload.stats;

    // Public broadcast: no per-user data
    this.server.emit(event.type, {
      ...event.payload,
      stats: publicStats,
    });

    // Per-user balance updates (wins/refunds only)
    for (const update of balanceUpdates) {
      this.server.to(this.getUserRoom(update.userId)).emit('balance:update', {
        balance: update.balance,
      });
    }

    // Per-user settled bet results (ALL participants, including pure losses)
    try {
      await this.emitUserRoundSettlements(event.payload.roundId, participants);
    } catch (error) {
      this.logger.warn(
        `round:user-settlement emit failed: ${this.unwrapError(error)}`,
      );
    }
  }

  private async emitUserRoundSettlements(
    roundId: number,
    participants: string[],
  ) {
    if (!participants.length) {
      return;
    }

    const bets = await this.prisma.bet.findMany({
      where: { roundId },
      include: { round: true },
      orderBy: { createdAt: 'asc' },
    });

    const betsByUser = new Map<string, typeof bets>();
    for (const bet of bets) {
      const list = betsByUser.get(bet.userId);
      if (list) list.push(bet);
      else betsByUser.set(bet.userId, [bet]);
    }

    for (const userId of participants) {
      const userBets = betsByUser.get(userId) ?? [];
      const serialized = userBets.map((bet) => ({
        id: bet.id,
        roundId: bet.roundId,
        betType: bet.betType,
        side: bet.side,
        digitType: bet.digitType,
        selection: bet.selection,
        amount: Number(bet.amount),
        odds: Number(bet.odds),
        result: bet.result,
        payout: Number(bet.payout),
        createdAt: bet.createdAt.toISOString(),
        lockedPrice: bet.round.lockedPrice
          ? Number(bet.round.lockedPrice)
          : null,
        finalPrice: bet.round.finalPrice ? Number(bet.round.finalPrice) : null,
        winningSide: bet.round.winningSide,
        digitResult: bet.round.digitResult ?? null,
        digitSum: bet.round.digitSum ?? null,
      }));

      const stake = serialized.reduce((sum, b) => sum + b.amount, 0);
      const payout = serialized.reduce((sum, b) => sum + b.payout, 0);

      this.server.to(this.getUserRoom(userId)).emit('round:user-settlement', {
        roundId,
        totals: {
          stake,
          payout,
          net: payout - stake,
        },
        bets: serialized,
      });
    }
  }
}
