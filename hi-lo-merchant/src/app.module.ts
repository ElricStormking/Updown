import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { GameConfigModule } from './config/game-config.module';
import { IntegrationModule } from './integration/integration.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [
        '.env',
        'environment.local',
        '../hi-lo-server/.env',
        '../hi-lo-server/environment.local',
        'hi-lo-server/.env',
        'hi-lo-server/environment.local',
      ],
      expandVariables: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    WalletModule,
    GameConfigModule,
    IntegrationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
