import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';
import { LaunchSessionController } from './launch-session.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [LaunchSessionController],
  providers: [LaunchSessionService, MerchantCallbackService],
  exports: [LaunchSessionService, MerchantCallbackService],
})
export class LaunchRuntimeModule {}
