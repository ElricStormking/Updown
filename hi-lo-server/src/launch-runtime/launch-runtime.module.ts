import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [LaunchSessionService, MerchantCallbackService],
  exports: [LaunchSessionService, MerchantCallbackService],
})
export class LaunchRuntimeModule {}

