import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // TypeScript typings for $on don't currently expose 'beforeExit' in this Prisma version,
    // but the method is available at runtime. Cast to any to register the handler safely.
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
