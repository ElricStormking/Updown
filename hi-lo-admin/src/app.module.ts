import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';
import { GameConfigProxyController } from './config/game-config-proxy.controller';

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
    AdminModule,
  ],
  controllers: [HealthController, GameConfigProxyController],
})
export class AppModule {}
