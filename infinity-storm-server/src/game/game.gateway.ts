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
import { RoundStatus } from '@prisma/client';

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
  ) {}

  onModuleInit() {
    this.priceSub = this.binancePrice.price$().subscribe((update) => {
      this.server.emit('price:update', update);
    });

    this.roundSub = this.roundEngine.events$().subscribe((event) => {
      this.server.emit(event.type, event.payload);

      if (event.type === 'round:result') {
        for (const update of event.payload.stats.balanceUpdates) {
          this.server
            .to(this.getUserRoom(update.userId))
            .emit('balance:update', {
              balance: update.balance,
            });
        }
      }
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
      client.data.userId = payload.sub;
      await client.join(this.getUserRoom(payload.sub));
      const wallet = await this.walletService.getOrCreateWallet(payload.sub);

      client.emit('balance:update', {
        balance: Number(wallet.balance),
      });

      return {
        status: 'ok',
        userId: payload.sub,
        email: payload.email,
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
        side: result.bet.side,
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
}
