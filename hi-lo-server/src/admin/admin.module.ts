import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminStatsService } from './admin-stats.service';
import { AdminDataService } from './admin-data.service';
import { AdminAccountsService } from './admin-accounts.service';
import { AdminAuthController } from './admin-auth.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminController, AdminAuthController],
  providers: [
    AdminStatsService,
    AdminDataService,
    AdminAccountsService,
    AdminGuard,
  ],
})
export class AdminModule {}
