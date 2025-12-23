# Platform Adapter Architecture — Multi-Platform Support

## Overview

This document outlines the architecture for supporting multiple gaming platforms/portals while maintaining a single, clean game server API. Your game client will always communicate with your server using a unified API, while your server handles platform-specific integrations through an adapter pattern.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR GAME CLIENT                                │
│                  (Phaser - hi-lo-client)                                │
│         Talks ONLY to your server's unified API                         │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      YOUR SERVER (hi-lo-server)                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Unified Game API                             │    │
│  │   /auth/login  •  /bets  •  WebSocket events                    │    │
│  └─────────────────────────────┬───────────────────────────────────┘    │
│                                │                                        │
│  ┌─────────────────────────────▼───────────────────────────────────┐    │
│  │                  Platform Adapter Layer                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │   Standalone │  │   Apollo/    │  │   Future     │           │    │
│  │  │   Adapter    │  │   Rocket     │  │   Platform   │           │    │
│  │  │   (default)  │  │   Adapter    │  │   Adapter    │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────────┬───────────────────────────────────┘    │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           ▼                     ▼                     ▼
    ┌─────────────┐      ┌─────────────────┐    ┌─────────────┐
    │  Your DB    │      │  Apollo/Rocket  │    │   Future    │
    │  (Prisma)   │      │  Platform API   │    │   Platform  │
    └─────────────┘      └─────────────────┘    └─────────────┘
```

---

## Core Concept

**Your game client never changes** — it always talks to your server using your clean, unified API. Your server acts as a translation layer, converting between your game's API and each platform's specific requirements (encryption, signatures, event names, etc.).

---

## Platform Adapter Interface

All platform adapters must implement this interface:

```typescript
// src/platform/platform-adapter.interface.ts

export interface PlatformUser {
  id: string;
  username: string;
  balance: number;
  currency: string;
  isDemo: boolean;
  metadata?: Record<string, unknown>;
}

export interface PlatformBetResult {
  success: boolean;
  transactionId?: string;
  newBalance: number;
  error?: string;
}

export interface PlatformAdapter {
  readonly name: string;
  
  // Authentication
  authenticate(credentials: Record<string, unknown>): Promise<PlatformUser>;
  validateSession(sessionId: string): Promise<PlatformUser | null>;
  
  // Wallet operations (credit/debit the platform's wallet)
  debit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult>;
  credit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult>;
  refund(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult>;
  getBalance(userId: string): Promise<number>;
  
  // Session management
  disconnect(userId: string, reason: string): Promise<void>;
  
  // Platform-specific hooks
  onRoundStart?(roundId: number): Promise<void>;
  onRoundEnd?(roundId: number, result: unknown): Promise<void>;
}
```

---

## Implementation Details

### 1. Standalone Adapter (Your Current System)

This adapter wraps your existing authentication and wallet services. It's used when the game runs standalone (not through a platform portal).

**Key Features:**
- Uses your existing `AuthService` and `WalletService`
- No external API calls needed
- Direct database access via Prisma

**Implementation:**

```typescript
// src/platform/adapters/standalone.adapter.ts

import { Injectable } from '@nestjs/common';
import { PlatformAdapter, PlatformUser, PlatformBetResult } from '../platform-adapter.interface';
import { AuthService } from '../../auth/auth.service';
import { WalletService } from '../../wallet/wallet.service';

@Injectable()
export class StandaloneAdapter implements PlatformAdapter {
  readonly name = 'standalone';

  constructor(
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
  ) {}

  async authenticate(credentials: { email: string; password: string }): Promise<PlatformUser> {
    const result = await this.authService.login(credentials);
    const wallet = await this.walletService.getOrCreateWallet(result.user.id);
    
    return {
      id: result.user.id,
      username: result.user.email,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isDemo: false,
    };
  }

  async validateSession(sessionId: string): Promise<PlatformUser | null> {
    // Validate JWT token
    const user = await this.authService.validatePayload(sessionId);
    if (!user) return null;
    
    const wallet = await this.walletService.getOrCreateWallet(user.id);
    return {
      id: user.id,
      username: user.email,
      balance: Number(wallet.balance),
      currency: wallet.currency,
      isDemo: false,
    };
  }

  async debit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    try {
      const wallet = await this.walletService.debit(userId, amount);
      return { 
        success: true, 
        newBalance: Number(wallet.balance),
        transactionId: betId,
      };
    } catch (error) {
      return { 
        success: false, 
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Debit failed',
      };
    }
  }

  async credit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    try {
      const wallet = await this.walletService.credit(userId, amount);
      return { 
        success: true, 
        newBalance: Number(wallet.balance),
        transactionId: betId,
      };
    } catch (error) {
      return { 
        success: false, 
        newBalance: 0,
        error: error instanceof Error ? error.message : 'Credit failed',
      };
    }
  }

  async refund(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    return this.credit(userId, amount, roundId, betId);
  }

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.walletService.getOrCreateWallet(userId);
    return Number(wallet.balance);
  }

  async disconnect(userId: string, reason: string): Promise<void> {
    // No-op for standalone - sessions handled by JWT expiry
  }
}
```

---

### 2. Apollo/Rocket Platform Adapter

This adapter integrates with the Apollo/Rocket platform API as specified in `Game Documentation.pdf`.

**Key Features:**
- Handles platform's encryption/decryption requirements
- Manages MD5 signatures for all events
- Connects to `rocket-socket-binary.aposcb.org` socket server
- Translates between your game events and platform's `binary-bet`/`binary-result` events

**Implementation:**

```typescript
// src/platform/adapters/apollo-rocket.adapter.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { io, Socket } from 'socket.io-client';
import * as crypto from 'crypto';
import { PlatformAdapter, PlatformUser, PlatformBetResult } from '../platform-adapter.interface';

@Injectable()
export class ApolloRocketAdapter implements PlatformAdapter {
  readonly name = 'apollo-rocket';
  private readonly logger = new Logger(ApolloRocketAdapter.name);
  private socket: Socket | null = null;
  private readonly hostId: string;
  private readonly accessToken: string;
  private readonly gameCode: number;
  private userSessions = new Map<string, { socket: Socket; balance: number }>();

  constructor(private readonly config: ConfigService) {
    this.hostId = config.getOrThrow('APOLLO_HOST_ID');
    this.accessToken = config.getOrThrow('APOLLO_ACCESS_TOKEN');
    this.gameCode = config.get('APOLLO_GAME_CODE', 195);
  }

  async authenticate(credentials: { access_token: string }): Promise<PlatformUser> {
    // Call their login API
    const response = await fetch('https://rocket-api.aposcb.org/api/user/get-settings-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        host_id: this.hostId,
        access_token: credentials.access_token,
        game_code: String(this.gameCode),
        is_promotion: '0',
      }),
    });

    const data = await response.json();
    
    // Connect to their socket
    const socket = await this.connectSocket(data.data);

    const user: PlatformUser = {
      id: String(data.data.user_id),
      username: data.data.username,
      balance: data.data.balance,
      currency: data.data.currency,
      isDemo: data.data.is_demo === 1,
      metadata: {
        rtp: data.data.rtp,
        is_apollo: data.data.is_apollo,
      },
    };

    this.userSessions.set(user.id, { socket, balance: user.balance });

    return user;
  }

  async validateSession(sessionId: string): Promise<PlatformUser | null> {
    const session = this.userSessions.get(sessionId);
    if (!session) return null;

    return {
      id: sessionId,
      username: 'apollo-user',
      balance: session.balance,
      currency: 'MYR',
      isDemo: false,
    };
  }

  async debit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    const session = this.userSessions.get(userId);
    if (!session) {
      return { success: false, newBalance: 0, error: 'Session not found' };
    }

    // Emit encrypted binary-bet to platform
    return new Promise((resolve) => {
      const timestamp = Date.now();
      const payload = this.encrypt({
        denominator: 1,
        bet_stake: amount,
        round_id: roundId,
        bet_id: betId,
        timestamp,
        signature: this.sign('binary-bet', amount, timestamp),
      });

      session.socket.emit('binary-bet', payload);

      // Wait for binary-result
      const handler = (encrypted: string) => {
        const result = this.decrypt(encrypted);
        session.socket.off('binary-result', handler);
        
        const newBalance = result.data.balance ?? session.balance - amount;
        session.balance = newBalance;
        
        resolve({
          success: result.data.result === 'win' || result.data.result === 'pending',
          transactionId: result.data.transaction_id,
          newBalance,
        });
      };
      session.socket.on('binary-result', handler);

      // Timeout after 10 seconds
      setTimeout(() => {
        session.socket.off('binary-result', handler);
        resolve({ success: false, newBalance: session.balance, error: 'Timeout' });
      }, 10000);
    });
  }

  async credit(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    // Platform handles this automatically via binary-result
    // Just update our cached balance
    const session = this.userSessions.get(userId);
    if (!session) {
      return { success: false, newBalance: 0, error: 'Session not found' };
    }

    session.balance += amount;
    return { success: true, newBalance: session.balance, transactionId: betId };
  }

  async refund(userId: string, amount: number, roundId: number, betId: string): Promise<PlatformBetResult> {
    return this.credit(userId, amount, roundId, betId);
  }

  async getBalance(userId: string): Promise<number> {
    const session = this.userSessions.get(userId);
    return session?.balance ?? 0;
  }

  async disconnect(userId: string, reason: string): Promise<void> {
    const session = this.userSessions.get(userId);
    if (session) {
      session.socket.disconnect();
      this.userSessions.delete(userId);
    }
  }

  private async connectSocket(userData: any): Promise<Socket> {
    const socket = io('https://rocket-socket-binary.aposcb.org', {
      transports: ['websocket'],
      upgrade: false,
    });

    return new Promise((resolve, reject) => {
      socket.on('connect', () => {
        const timestamp = Date.now();
        const subscribePayload = this.encrypt({
          host_id: this.hostId,
          access_token: this.accessToken,
          user_id: userData.user_id,
          game_code: this.gameCode,
          credits: userData.balance,
          username: userData.username,
          is_demo: userData.is_demo,
          rtp: userData.rtp,
          currency: userData.currency,
          is_apollo: userData.is_apollo,
          default_bet: 0,
          ip_address: '0.0.0.0', // Server-side, use actual if needed
          device_type: 'Server',
          os_type: 'Node.js',
          browser_type: 'Server',
          user_agent: 'HiLo-Server/1.0',
          event_type: 0,
          timestamp,
          signature: this.sign('subscribe', 0, timestamp),
        });

        socket.emit('subscribe', subscribePayload);
      });

      socket.on('onSubscribeDone', (encrypted: string) => {
        const result = this.decrypt(encrypted);
        if (result.status_code === 0) {
          resolve(socket);
        } else {
          reject(new Error('Subscribe failed'));
        }
      });

      socket.on('kick-user', (data) => {
        this.logger.warn(`User kicked: ${data.message}`);
      });

      socket.on('kick-user-maintenance', (data) => {
        this.logger.warn(`Maintenance kick: ${data.message}`);
      });

      socket.on('kick', (data) => {
        this.logger.warn(`Kick: ${data.message}`);
      });

      socket.on('balance', (encrypted: string) => {
        const result = this.decrypt(encrypted);
        // Update balance for user session
        const userId = String(userData.user_id);
        const session = this.userSessions.get(userId);
        if (session) {
          session.balance = result.data.balance;
        }
      });
    });
  }

  private sign(event: string, amount: number, timestamp: number): string {
    const str = amount > 0
      ? `${event}${amount}${timestamp}${this.hostId}${this.accessToken}`
      : `${event}${timestamp}${this.hostId}${this.accessToken}`;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private encrypt(data: object): string {
    // TODO: Use their ecrypt library - you'll need to port/require it
    // Download from: https://drive.google.com/file/d/17ZB1zNgQ4E-d8b5pugOp9L0jh68G0EBq/view?usp=sharing
    // For now, placeholder (MUST be replaced with actual encryption):
    return JSON.stringify(data);
  }

  private decrypt(data: string): any {
    // TODO: Use their ecrypt library
    // For now, placeholder (MUST be replaced with actual decryption):
    return JSON.parse(data);
  }
}
```

---

### 3. Platform Service (Factory/Router)

The `PlatformService` manages all adapters and routes requests to the correct one.

```typescript
// src/platform/platform.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdapter } from './platform-adapter.interface';
import { StandaloneAdapter } from './adapters/standalone.adapter';
import { ApolloRocketAdapter } from './adapters/apollo-rocket.adapter';

@Injectable()
export class PlatformService implements OnModuleInit {
  private adapters = new Map<string, PlatformAdapter>();
  private defaultAdapter: string;

  constructor(
    private readonly config: ConfigService,
    private readonly standaloneAdapter: StandaloneAdapter,
    private readonly apolloAdapter: ApolloRocketAdapter,
  ) {
    this.defaultAdapter = config.get('PLATFORM_DEFAULT', 'standalone');
  }

  onModuleInit() {
    this.register(this.standaloneAdapter);
    this.register(this.apolloAdapter);
  }

  register(adapter: PlatformAdapter) {
    this.adapters.set(adapter.name, adapter);
  }

  get(platformId?: string): PlatformAdapter {
    const id = platformId ?? this.defaultAdapter;
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Unknown platform: ${id}`);
    }
    return adapter;
  }

  list(): string[] {
    return Array.from(this.adapters.keys());
  }
}
```

---

### 4. Platform Module

```typescript
// src/platform/platform.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformService } from './platform.service';
import { StandaloneAdapter } from './adapters/standalone.adapter';
import { ApolloRocketAdapter } from './adapters/apollo-rocket.adapter';
import { AuthModule } from '../auth/auth.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [ConfigModule, AuthModule, WalletModule],
  providers: [
    PlatformService,
    StandaloneAdapter,
    ApolloRocketAdapter,
  ],
  exports: [PlatformService],
})
export class PlatformModule {}
```

---

### 5. Modified Auth Controller

Update your auth controller to accept a platform parameter:

```typescript
// src/auth/auth.controller.ts (modifications)

import { PlatformService } from '../platform/platform.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly platformService: PlatformService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Query('platform') platform?: string,
  ) {
    const adapter = this.platformService.get(platform);
    const platformUser = await adapter.authenticate(dto);
    
    // Generate your internal JWT with platform info
    const token = await this.authService.generateToken({
      sub: platformUser.id,
      email: platformUser.username,
      platform: adapter.name,
    });

    return { 
      accessToken: token, 
      user: {
        id: platformUser.id,
        email: platformUser.username,
        platform: adapter.name,
      },
    };
  }
}
```

---

### 6. Modified Bets Service

Update your bets service to use the platform adapter for wallet operations:

```typescript
// src/bets/bets.service.ts (key modifications)

import { PlatformService } from '../platform/platform.service';

@Injectable()
export class BetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformService: PlatformService,
  ) {}

  async placeBet(userId: string, dto: PlaceBetDto, platformId: string) {
    const adapter = this.platformService.get(platformId);
    
    // Debit from the platform's wallet
    const betId = `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const debitResult = await adapter.debit(userId, dto.amount, dto.roundId, betId);
    
    if (!debitResult.success) {
      throw new BadRequestException(debitResult.error ?? 'Debit failed');
    }

    // Record bet in your DB for game logic
    const bet = await this.prisma.bet.create({
      data: {
        roundId: dto.roundId,
        userId,
        side: dto.side,
        amount: dto.amount,
        platformTransactionId: debitResult.transactionId,
      },
    });

    return { bet, walletBalance: debitResult.newBalance };
  }

  async settleBet(bet: Bet, won: boolean, platformId: string) {
    const adapter = this.platformService.get(platformId);
    
    if (won) {
      const payout = bet.amount * bet.odds;
      await adapter.credit(bet.userId, payout, bet.roundId, bet.id);
    }
    // Platform already has the stake from debit, no action needed if lost
  }

  async refundBet(bet: Bet, platformId: string) {
    const adapter = this.platformService.get(platformId);
    await adapter.refund(bet.userId, bet.amount, bet.roundId, bet.id);
  }
}
```

---

### 7. Modified Game Gateway

Update your WebSocket gateway to extract platform from JWT and use the adapter:

```typescript
// src/game/game.gateway.ts (modifications)

import { PlatformService } from '../platform/platform.service';

@WebSocketGateway({ namespace: 'game' })
export class GameGateway {
  constructor(
    // ... existing dependencies
    private readonly platformService: PlatformService,
  ) {}

  @SubscribeMessage('client:ready')
  async handleClientReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: ClientReadyDto,
  ) {
    try {
      const payload = await this.verifyToken(body.token);
      const platformId = payload.platform ?? 'standalone';
      const adapter = this.platformService.get(platformId);
      
      // Validate session with platform
      const platformUser = await adapter.validateSession(payload.sub);
      if (!platformUser) {
        throw new UnauthorizedException('Invalid session');
      }

      client.data.userId = payload.sub;
      client.data.platformId = platformId;
      
      await client.join(this.getUserRoom(payload.sub));
      
      client.emit('balance:update', {
        balance: platformUser.balance,
      });

      return {
        status: 'ok',
        userId: payload.sub,
        email: payload.email,
      };
    } catch (error) {
      this.logger.warn(`client:ready failed: ${error}`);
      throw error;
    }
  }

  @SubscribeMessage('bet:place')
  async handleBetPlace(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PlaceBetDto,
  ) {
    this.ensureAuthenticated(client);
    const platformId = client.data.platformId ?? 'standalone';
    
    try {
      const result = await this.betsService.placeBet(
        client.data.userId, 
        body, 
        platformId
      );
      
      // ... rest of handler
    } catch (error) {
      // ... error handling
    }
  }
}
```

---

## Folder Structure

```
hi-lo-server/src/
├── platform/
│   ├── platform.module.ts
│   ├── platform.service.ts
│   ├── platform-adapter.interface.ts
│   └── adapters/
│       ├── standalone.adapter.ts
│       ├── apollo-rocket.adapter.ts
│       └── future-platform.adapter.ts   # Add more as needed
├── auth/
│   └── auth.controller.ts               # Modified to use PlatformService
├── bets/
│   └── bets.service.ts                  # Modified to use PlatformService
└── game/
    └── game.gateway.ts                  # Modified to use PlatformService
```

---

## Configuration

Add these environment variables:

```env
# .env

# Default platform (standalone, apollo-rocket, etc.)
PLATFORM_DEFAULT=standalone

# Apollo/Rocket Platform Configuration
APOLLO_HOST_ID=0e83088027d4c42c8e9934388480c996
APOLLO_ACCESS_TOKEN=demo01
APOLLO_GAME_CODE=195
```

---

## Benefits

| Benefit | How It Works |
|---------|--------------|
| **Single client codebase** | Game client only talks to your server API - never changes |
| **Platform isolation** | Each adapter handles platform quirks (encryption, signatures, event names) |
| **Easy to add platforms** | Just implement `PlatformAdapter` interface and register |
| **Testable** | Swap adapters in tests, mock platform responses |
| **Your game logic stays clean** | Round engine, odds, history — all in your server, platform-agnostic |
| **Maintainable** | Platform-specific code isolated in adapters |

---

## Adding a New Platform

To add support for a new platform:

1. **Create adapter file**: `src/platform/adapters/new-platform.adapter.ts`
2. **Implement `PlatformAdapter` interface**
3. **Register in `PlatformModule`**:
   ```typescript
   providers: [
     // ... existing
     NewPlatformAdapter,
   ],
   ```
4. **Register in `PlatformService.onModuleInit()`**:
   ```typescript
   this.register(this.newPlatformAdapter);
   ```
5. **Add configuration** to `.env` if needed

---

## Important Notes

### Apollo/Rocket Adapter Encryption

The Apollo/Rocket adapter currently has placeholder encryption/decryption methods. You **MUST** replace these with their actual encryption library:

- Download from: https://drive.google.com/file/d/17ZB1zNgQ4E-d8b5pugOp9L0jh68G0EBq/view?usp=sharing
- Port the JavaScript encryption functions to TypeScript/Node.js
- Replace `encrypt()` and `decrypt()` methods in `ApolloRocketAdapter`

### Session Management

- **Standalone**: Sessions handled via JWT tokens (your current system)
- **Apollo/Rocket**: Sessions managed via socket connections - store socket instances per user
- **Future platforms**: May require different session strategies

### Error Handling

Each adapter should handle platform-specific errors gracefully:
- Network timeouts
- Invalid signatures
- Platform maintenance
- User kicks/disconnections

---

## Testing Strategy

1. **Unit tests** for each adapter in isolation
2. **Integration tests** for platform service routing
3. **E2E tests** for full game flow with each platform
4. **Mock adapters** for testing game logic without platform dependencies

---

## Migration Path

1. **Phase 1**: Implement `PlatformModule` and `StandaloneAdapter` (wraps existing code)
2. **Phase 2**: Update `AuthController` and `BetsService` to use `PlatformService`
3. **Phase 3**: Implement `ApolloRocketAdapter` with encryption
4. **Phase 4**: Test both platforms end-to-end
5. **Phase 5**: Add more platforms as needed

---

## Questions & Considerations

- **How to determine platform?** 
  - Query parameter: `?platform=apollo-rocket`
  - JWT claim: Store platform in token during login
  - Subdomain: `apollo.yourgame.com` vs `standalone.yourgame.com`

- **Multiple platforms simultaneously?**
  - Yes, each user session is tied to one platform
  - Platform determined at login time

- **Platform-specific game features?**
  - Use `metadata` field in `PlatformUser` to store platform-specific data
  - Add optional hooks in adapter interface (`onRoundStart`, `onRoundEnd`)

---

## Next Steps

1. Review this architecture plan
2. Implement `PlatformModule` structure
3. Port Apollo/Rocket encryption library
4. Test with both platforms
5. Document platform-specific requirements for each adapter


