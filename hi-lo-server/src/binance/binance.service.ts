import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CacheKeys } from '../common/constants/cache-keys';
import { PriceUpdate } from './interfaces/price-update.interface';
import { GameConfigService } from '../config/game-config.service';

type BinanceTradePayload = {
  p?: string;
  c?: string;
  price?: string;
  E?: number;
  T?: number;
};

@Injectable()
export class BinancePriceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinancePriceService.name);
  private readonly priceSubject = new Subject<PriceUpdate>();
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private disposed = false;
  private lastPrice?: PriceUpdate;
  private lastSnapshotAt = 0;
  private lastEmitAt = 0;
  private lastPersistAt = 0;
  private readonly reconnectDelayMs: number;
  private readonly heartbeatIntervalMs: number;
  private snapshotIntervalMs: number;
  private readonly priceCacheTtlMs: number;
  // Throttle noisy trade stream so timers/DB don't get starved under load.
  private readonly emitIntervalMs = 250;
  private readonly persistIntervalMs = 1000;

  constructor(
    private readonly configService: ConfigService,
    private readonly gameConfigService: GameConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.reconnectDelayMs = this.configService.getOrThrow<number>(
      'binance.reconnectDelayMs',
      { infer: true },
    );
    this.heartbeatIntervalMs = this.configService.getOrThrow<number>(
      'binance.heartbeatIntervalMs',
      { infer: true },
    );
    this.snapshotIntervalMs =
      this.gameConfigService.getDefaultConfig().priceSnapshotInterval;
    const redisTtlSeconds = this.configService.getOrThrow<number>(
      'redis.ttlSeconds',
      { infer: true },
    );
    // Keep cached price fresher than redis TTL while recovering.
    this.priceCacheTtlMs = Math.max(
      redisTtlSeconds * 1000,
      this.heartbeatIntervalMs * 5,
    );
  }

  async onModuleInit() {
    await this.connect();
    this.startHeartbeat();
  }

  async onModuleDestroy() {
    this.disposed = true;
    this.priceSubject.complete();
    this.stopHeartbeat();
    this.teardownSocket();
  }

  price$() {
    return this.priceSubject.asObservable();
  }

  async getLatestPrice(): Promise<PriceUpdate | null> {
    if (this.lastPrice) {
      return this.lastPrice;
    }

    const cached = await this.redis.getJson<PriceUpdate>(CacheKeys.btcPrice);
    if (cached) {
      this.lastPrice = cached;
    }

    return cached ?? null;
  }

  private async connect() {
    const wsUrl = this.configService.getOrThrow<string>('binance.wsUrl');
    this.logger.log(`Connecting to Binance WS: ${wsUrl}`);
    this.teardownSocket();

    this.ws = new WebSocket(wsUrl);
    this.ws.on('open', () => this.logger.log('Binance WS connected'));
    this.ws.on('message', (raw) => this.handleMessage(raw));
    this.ws.on('close', (code: number) => {
      this.logger.warn(`Binance WS closed (${code}), scheduling reconnect`);
      this.scheduleReconnect();
    });
    this.ws.on('error', (err: Error) => {
      this.logger.error(`Binance WS error: ${err.message}`);
      this.scheduleReconnect();
    });
  }

  private teardownSocket() {
    if (!this.ws) {
      return;
    }

    const ws = this.ws;
    this.ws = undefined;

    ws.removeAllListeners();
    // Terminating a socket before it is fully connected can emit an 'error' event.
    // Ensure we don't crash due to an unhandled error during teardown.
    ws.on('error', () => undefined);
    try {
      ws.terminate();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Binance WS teardown error: ${reason}`);
    }
  }

  private scheduleReconnect() {
    if (this.disposed) {
      return;
    }
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, this.reconnectDelayMs);
  }

  private handleMessage(raw: WebSocket.RawData) {
    try {
      const payload = JSON.parse(raw.toString()) as BinanceTradePayload;
      const priceValue = Number(payload.p ?? payload.c ?? payload.price);
      if (Number.isNaN(priceValue)) {
        return;
      }
      const timestamp = Number(payload.E ?? payload.T ?? Date.now());
      const update: PriceUpdate = {
        price: priceValue,
        timestamp,
      };

      this.lastPrice = update;
      // Emit to subscribers at a capped rate (UI doesn't need every trade tick).
      if (timestamp - this.lastEmitAt >= this.emitIntervalMs) {
        this.lastEmitAt = timestamp;
        this.priceSubject.next(update);
      }

      // Persist/cache at a capped rate (DB/redis don't need every tick).
      if (timestamp - this.lastPersistAt >= this.persistIntervalMs) {
        this.lastPersistAt = timestamp;
        void this.persistPrice(update);
      }
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to parse Binance payload: ${reason}`);
    }
  }

  private async persistPrice(update: PriceUpdate) {
    const config = await this.gameConfigService.getActiveConfig();
    this.snapshotIntervalMs = config.priceSnapshotInterval;
    try {
      await this.redis.setJson(
        CacheKeys.btcPrice,
        update,
        this.priceCacheTtlMs,
      );
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis price cache error: ${reason}`);
    }

    if (update.timestamp - this.lastSnapshotAt < this.snapshotIntervalMs) {
      return;
    }

    this.lastSnapshotAt = update.timestamp;
    try {
      await this.prisma.priceSnapshot.create({
        data: {
          timestamp: new Date(update.timestamp),
          price: update.price,
          source: 'BINANCE',
        },
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to write price snapshot: ${reason}`);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.lastPrice) {
        return;
      }

      const delta = Date.now() - this.lastPrice.timestamp;
      if (delta > this.heartbeatIntervalMs * 5) {
        this.logger.warn(
          `Price heartbeat stale (${delta} ms). Forcing reconnect.`,
        );
        this.scheduleReconnect();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
