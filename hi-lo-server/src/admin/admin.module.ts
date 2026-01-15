import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [AdminStatsService, AdminGuard],
})
export class AdminModule {}
