import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BinanceModule } from '../binance/binance.module';
import { RedisModule } from '../redis/redis.module';
import { RoundEngineService } from './round-engine.service';
import { BetsModule } from '../bets/bets.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';
import { GameGateway } from './game.gateway';
import { GameConfigModule } from '../config/game-config.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BinanceModule,
    RedisModule,
    BetsModule,
    WalletModule,
    AuthModule,
    GameConfigModule,
    IntegrationModule,
  ],
  providers: [RoundEngineService, GameGateway],
  exports: [RoundEngineService, GameGateway],
})
export class GameModule {}
