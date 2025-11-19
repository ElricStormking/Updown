import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BinancePriceService } from './binance.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  providers: [BinancePriceService],
  exports: [BinancePriceService],
})
export class BinanceModule {}
