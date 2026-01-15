import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { GameConfigModule } from '../config/game-config.module';

@Module({
  imports: [ConfigModule, PrismaModule, WalletModule, GameConfigModule],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
