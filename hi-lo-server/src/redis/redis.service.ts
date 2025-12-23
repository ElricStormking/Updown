import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private enabled = true;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('redis.url');

    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: () => null, // Disable automatic reconnection attempts
    });

    // Suppress error events - we handle connection failures in onModuleInit
    this.client.on('error', () => {
      // Errors are handled during connection attempt, no need to log here
    });
  }

  async onModuleInit() {
    if (this.client.status === 'wait') {
      try {
        await this.client.connect();
        this.logger.log('Redis connected successfully');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.enabled = false;
        this.logger.log(
          `Redis unavailable: continuing without cache. Reason: ${reason}`,
        );
      }
    }
  }

  async onModuleDestroy() {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.quit();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis shutdown error: ${reason}`);
    }
  }

  getClient() {
    return this.client;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<'OK' | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      if (ttlMs && ttlMs > 0) {
        return await this.client.set(key, value, 'PX', ttlMs);
      }

      return await this.client.set(key, value);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // If the connection is gone, disable cache to avoid repeated overhead/log spam.
      if (
        reason.includes('Connection is closed') ||
        reason.includes('ECONNREFUSED') ||
        reason.includes('ETIMEDOUT')
      ) {
        this.enabled = false;
      }
      this.logger.warn(`Redis set error for key "${key}": ${reason}`);
      return null;
    }
  }

  async get(key: string) {
    if (!this.enabled) {
      return null;
    }

    try {
      return await this.client.get(key);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (
        reason.includes('Connection is closed') ||
        reason.includes('ECONNREFUSED') ||
        reason.includes('ETIMEDOUT')
      ) {
        this.enabled = false;
      }
      this.logger.warn(`Redis get error for key "${key}": ${reason}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs?: number) {
    return this.set(key, JSON.stringify(value), ttlMs);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis JSON parse error for key "${key}": ${reason}`);
      return null;
    }
  }

  async del(...keys: string[]) {
    if (!this.enabled || !keys.length) {
      return 0;
    }

    try {
      return await this.client.del(keys);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis del error for keys [${keys.join(', ')}]: ${reason}`);
      return 0;
    }
  }
}
