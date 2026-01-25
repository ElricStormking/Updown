# Platform Integration Service Implementation Plan

## Overview
Modify the hi-lo-server to expose public APIs for external casino platforms (merchants) to integrate with the bitcoin price digits guessing game. This follows a B2B wallet transfer model where merchants manage player funds.

---

## Phase 1: Database Schema Changes

### 1.1 New `Merchant` Table
```prisma
model Merchant {
  id        String   @id @default(cuid())
  merchantId String  @unique  // Public identifier for API calls
  name      String
  hashKey   String   // 32-char BASE64 secret for signature
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  transfers Transfer[]
}
```

### 1.2 New `Transfer` Table (for tracking merchant transfers)
```prisma
model Transfer {
  id            String   @id @default(cuid())
  merchantId    String
  userId        String
  orderNo       String   // Merchant's transfer order number
  type          Int      // 0 = into game, 1 = out to merchant
  amount        Decimal  @db.Decimal(18, 6)
  balanceAfter  Decimal  @db.Decimal(18, 6)
  createdAt     DateTime @default(now())
  merchant      Merchant @relation(fields: [merchantId], references: [merchantId])
  user          User     @relation(fields: [userId], references: [id])

  @@unique([merchantId, orderNo])
  @@index([merchantId, createdAt])
}
```

### 1.3 Modify `User` Table
- Add `merchantId` field (nullable for backward compatibility with direct users)
- Add `merchantAccount` field to store merchant's player identifier
- Add unique constraint on `(merchantId, merchantAccount)`

### 1.4 Modify `Bet` Table
- Add `merchantId` field (nullable, populated from user's merchant)

---

## Phase 2: New Integration Module

### 2.1 Create `src/integration/` Module
```
src/integration/
  integration.module.ts
  integration.controller.ts
  integration.service.ts
  dto/
    account-create.dto.ts
    transfer.dto.ts
    get-bet-history.dto.ts
    get-transfer-history.dto.ts
    launch-game.dto.ts
    integration-response.dto.ts
  guards/
    merchant-auth.guard.ts
  utils/
    signature.utils.ts
```

### 2.2 Signature Utility (`signature.utils.ts`)
- `generateSignature(params: string[], hashKey: string): string` - SHA256 hash
- `validateTimestamp(timestamp: number, toleranceSec: number): boolean` - 5-10 sec window

### 2.3 Merchant Auth Guard
- Validate `merchantId` exists and is active
- Validate timestamp within tolerance (5-10 seconds)
- Validate signature matches expected hash

---

## Phase 3: Integration API Endpoints

All endpoints return:
```typescript
{
  success: boolean;
  errorCode: number;     // 0 = success
  errorMessage: string;  // Empty on success
  data: T | null;
}
```

### 3.1 `POST /integration/account/create` - AccountCreate
- Creates merchant player in User table
- Auto-creates wallet with 0 balance
- Returns success/error response

### 3.2 `POST /integration/transfer` - Transfer
- Type 0: Transfer funds INTO game (credit wallet)
- Type 1: Transfer funds OUT to merchant (debit wallet)
- Records transfer in Transfer table
- Returns balance after transfer

### 3.3 `POST /integration/bets` - GetBetHistory
- Paginated bet history for merchant's players
- Filter by `startBetTime`, `pageSize` (1-100), `pageNumber`
- Returns bets with round details

### 3.4 `POST /integration/transfers` - GetTransferHistory
- Paginated transfer history for merchant
- Filter by `startTime`, `pageSize` (1-100), `pageNumber`

### 3.5 `POST /integration/launch` - LaunchGame
- Validates merchant player exists
- Generates JWT access token for game client
- Returns game URL with embedded token

---

## Phase 4: Service Layer Implementation

### 4.1 `IntegrationService`
- `createAccount(merchantId, account)` - Create user with merchant association
- `transfer(merchantId, account, orderNo, type, amount)` - Handle fund transfers
- `getBetHistory(merchantId, startTime, pageSize, pageNumber)` - Query bets
- `getTransferHistory(merchantId, startTime, pageSize, pageNumber)` - Query transfers
- `launchGame(merchantId, account)` - Generate access token and game URL

### 4.2 Modify `AuthService`
- Add method to generate token for merchant players (no password required)

### 4.3 Modify `UsersService`
- Support creating users with merchant association
- Find user by merchant account

---

## Phase 5: Error Codes

| Code | Description |
|------|-------------|
| 0    | Success |
| 1001 | Invalid signature |
| 1002 | Timestamp expired |
| 1003 | Merchant not found |
| 1004 | Merchant inactive |
| 2001 | Account already exists |
| 2002 | Account not found |
| 3001 | Insufficient balance |
| 3002 | Duplicate order number |
| 3003 | Invalid transfer type |
| 9999 | Internal error |

---

## Phase 6: Configuration & Security

### 6.1 Environment Variables
```env
INTEGRATION_TIMESTAMP_TOLERANCE_SEC=10
INTEGRATION_GAME_URL=https://game.example.com
```

### 6.2 Rate Limiting (optional but recommended)
- Add rate limiting per merchant ID

---

## Phase 7: Migration & Testing

### 7.1 Prisma Migration
- Create migration for new tables and modified fields
- Ensure backward compatibility (nullable merchantId on User/Bet)

### 7.2 Testing
- Unit tests for signature validation
- Integration tests for each API endpoint
- Test timestamp tolerance edge cases

---

## Implementation Order

1. **Database**: Create Prisma schema changes and run migration
2. **Utils**: Implement signature generation/validation
3. **Guard**: Implement MerchantAuthGuard
4. **DTOs**: Create all request/response DTOs
5. **Service**: Implement IntegrationService
6. **Controller**: Wire up all endpoints
7. **Module**: Register in AppModule
8. **Tests**: Add comprehensive test coverage

---

## File Changes Summary

| Action | Path |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `src/integration/integration.module.ts` |
| Create | `src/integration/integration.controller.ts` |
| Create | `src/integration/integration.service.ts` |
| Create | `src/integration/dto/*.ts` (6 files) |
| Create | `src/integration/guards/merchant-auth.guard.ts` |
| Create | `src/integration/utils/signature.utils.ts` |
| Modify | `src/users/users.service.ts` |
| Modify | `src/auth/auth.service.ts` |
| Modify | `src/app.module.ts` |
| Modify | `src/config/configuration.ts` |

Estimated new lines of code: ~800-1000 lines