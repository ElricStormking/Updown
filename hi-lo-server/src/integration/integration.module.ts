import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntegrationController } from './integration.controller';
import { IntegrationLaunchSessionController } from './integration-launch-session.controller';
import { IntegrationService } from './integration.service';
import { MerchantAuthGuard } from './guards/merchant-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { GameConfigModule } from '../config/game-config.module';
import { LaunchSessionService } from './launch-session.service';
import { MerchantCallbackService } from './merchant-callback.service';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    GameConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('auth.jwtSecret') ?? 'change-me',
        signOptions: {
          expiresIn: (configService.get<string>('auth.jwtExpiresIn') ??
            '1h') as any,
        },
      }),
    }),
  ],
  controllers: [IntegrationController, IntegrationLaunchSessionController],
  providers: [
    IntegrationService,
    MerchantAuthGuard,
    LaunchSessionService,
    MerchantCallbackService,
  ],
  exports: [IntegrationService, LaunchSessionService, MerchantCallbackService],
})
export class IntegrationModule {}
