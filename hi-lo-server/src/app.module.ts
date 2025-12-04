import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { GameConfigController } from './config/game-config.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { RedisModule } from './redis/redis.module';
import { BinanceModule } from './binance/binance.module';
import { GameModule } from './game/game.module';
import { BetsModule } from './bets/bets.module';
import { HistoryModule } from './history/history.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['environment.local', '.env'],
      expandVariables: true,
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    UsersModule,
    AuthModule,
    WalletModule,
    BinanceModule,
    BetsModule,
    HistoryModule,
    GameModule,
  ],
  controllers: [AppController, GameConfigController],
  providers: [AppService],
})
export class AppModule {}
