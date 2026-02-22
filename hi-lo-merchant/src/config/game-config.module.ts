import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameConfigService } from './game-config.service';

@Module({
  imports: [PrismaModule],
  providers: [GameConfigService],
  exports: [GameConfigService],
})
export class GameConfigModule {}
