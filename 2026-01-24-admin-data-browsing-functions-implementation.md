## Implementation Plan: Admin Data Browsing Functions

Based on `backend_spec_english.md`, the following data browsing (query) endpoints need to be implemented for the admin tools. The spec defines "Query" operations for multiple entities, and the current admin module only has tuning (game config) and daily RTP functionality.

### New Admin API Endpoints to Implement

#### 1. Backend Account Management
- **`GET /admin/accounts`** - List admin accounts (account, status)
- **`GET /admin/accounts/login-records`** - Query login records (account, result, failureReason, loginTime)
- **`POST /admin/accounts`** - Create admin account
- **`PUT /admin/accounts/:id`** - Update admin account (password, status)

#### 2. Game Management
- **`GET /admin/rounds`** - Query round data (roundId, startTime, lockTime, endTime, lockedPrice, finalPrice, rise/fall, status, timestamps) with pagination/filtering
- **`GET /admin/bets`** - Query bet data (betId, merchantId, playerId, roundId, bet details, amount, status, payout, timestamps) with pagination/filtering
- **`GET /admin/price-snapshots`** - Query Bitcoin price data (id, timestamp, source, createdTime)

#### 3. Merchant Management
- **`GET /admin/merchants`** - List merchants (merchantId, name, currency, min/max bet, signature key)
- **`POST /admin/merchants`** - Create merchant
- **`PUT /admin/merchants/:id`** - Update merchant
- **`GET /admin/merchants/:id/odds`** - Query merchant game odds settings
- **`PUT /admin/merchants/:id/odds`** - Update merchant odds

#### 4. Player Management
- **`GET /admin/players`** - Query players (merchantId, account, status) with pagination/filtering
- **`PUT /admin/players/:id/status`** - Update player status (enabled/disabled)
- **`GET /admin/players/logins`** - Query player login (game launch) records

#### 5. Financial Management
- **`GET /admin/transfers`** - Query transfer records (merchantId, account, orderNos, type, time) with pagination/filtering
- **`GET /admin/transactions`** - Query wallet transaction records (merchantId, account, type, txNumber, balanceBefore, amount, balanceAfter, time)

---

### Implementation Structure

```
hi-lo-server/src/admin/
├── admin.module.ts           (update - add new providers/imports)
├── admin.controller.ts       (update - add new endpoints)
├── admin-stats.service.ts    (existing - daily RTP)
├── admin-data.service.ts     (new - data browsing queries)
├── admin-accounts.service.ts (new - admin account management)
├── dto/
│   ├── query-rounds.dto.ts
│   ├── query-bets.dto.ts
│   ├── query-players.dto.ts
│   ├── query-transfers.dto.ts
│   ├── query-transactions.dto.ts
│   ├── create-merchant.dto.ts
│   ├── update-merchant.dto.ts
│   ├── create-admin-account.dto.ts
│   └── update-admin-account.dto.ts
```

### Database Schema Changes Required

New models needed in `prisma/schema.prisma`:
```prisma
model AdminAccount {
  id        String   @id @default(cuid())
  account   String   @unique
  password  String
  status    AdminAccountStatus @default(ENABLED)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  loginRecords AdminLoginRecord[]
}

enum AdminAccountStatus {
  ENABLED
  LOCKED
  DISABLED
}

model AdminLoginRecord {
  id            String   @id @default(cuid())
  adminId       String
  result        Boolean
  failureReason String?
  loginTime     DateTime @default(now())
  admin         AdminAccount @relation(fields: [adminId], references: [id])
  @@index([adminId, loginTime])
}

model WalletTransaction {
  id            String   @id @default(cuid())
  merchantId    String?
  userId        String
  type          WalletTxType
  referenceId   String?
  balanceBefore Decimal  @db.Decimal(18, 6)
  amount        Decimal  @db.Decimal(18, 6)
  balanceAfter  Decimal  @db.Decimal(18, 6)
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
  @@index([merchantId, createdAt])
}

enum WalletTxType {
  TRANSFER_IN
  TRANSFER_OUT
  BET
  CANCEL
  PAYOUT
  BONUS
}

model PlayerLogin {
  id         String   @id @default(cuid())
  merchantId String
  userId     String
  loginTime  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  @@index([merchantId, loginTime])
}
```

Also need to add to `Merchant` model:
- `currency`, `maxBetAmount`, `minBetAmount` fields (if not already present via config)
- Merchant-specific odds settings (new model or JSON field)

### Implementation Steps

1. **Database Migration** - Add new models (AdminAccount, AdminLoginRecord, WalletTransaction, PlayerLogin) and update Merchant model
2. **DTOs** - Create query/response DTOs with validation for pagination and filtering
3. **Services** - Implement `AdminDataService` and `AdminAccountsService` with Prisma queries
4. **Controller** - Add all new endpoints to `AdminController` with proper guards
5. **Frontend** - Update admin HTML page to include new data browsing UI sections (tables with filters)
6. **Testing** - Add tests for new endpoints

### Key Considerations
- All endpoints protected by `JwtAuthGuard` + `AdminGuard`
- Pagination support (page, limit, hasNext pattern already established)
- Date range filtering for time-based queries
- Sensitive data handling (password hashes never returned, signature keys masked)
