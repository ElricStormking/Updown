import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BinancePriceService } from './binance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GameConfigModule } from '../config/game-config.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, GameConfigModule],
  providers: [BinancePriceService],
  exports: [BinancePriceService],
})
export class BinanceModule {}
