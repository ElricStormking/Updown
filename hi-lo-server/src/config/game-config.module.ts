import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GameConfigController } from './game-config.controller';
import { GameConfigService } from './game-config.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [GameConfigController],
  providers: [GameConfigService, AdminGuard],
  exports: [GameConfigService],
})
export class GameConfigModule {}
