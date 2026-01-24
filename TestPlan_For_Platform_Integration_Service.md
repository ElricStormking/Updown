# Platform Integration Service - Test Plan

## Prerequisites

1. Server running on port **4001**
2. Database migration applied
3. Test merchant seeded

## Step-by-Step Testing

### Step 1: Apply Migration and Seed Database

```bash
cd hi-lo-server
npx prisma migrate deploy
npx prisma db seed
```

This creates the test merchant:
- **merchantId**: `TEST_MERCHANT`
- **hashKey**: `dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=`

### Step 2: Start the Server

```bash
npm run start:dev
```

Server runs on: `http://localhost:4001`

---

## Test Scripts (PowerShell Commands)

The test helper script is located at: `hi-lo-server/Test-scripts/test-integration-api.ts`

### 2.1 Create Account

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "create-account" "player001"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": null
}
```

### 2.2 Transfer (Deposit) - Add funds to player

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "transfer-in" "player001" "100" "ORDER001"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": { "balance": 100 }
}
```

### 2.3 LaunchGame - Get game URL with token

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "launch" "player001"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": { "url": "https://game.example.com?accessToken=<JWT_TOKEN>" }
}
```

### 2.4 Transfer (Withdraw) - Withdraw funds from player

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "transfer-out" "player001" "50" "ORDER002"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": { "balance": 50 }
}
```

### 2.5 GetTransferHistory - View transfer records

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "transfer-history"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "transfers": [...],
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 2,
    "totalPageNumber": 1
  }
}
```

### 2.6 GetBetHistory - View bet records (after player places bets)

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "bet-history"
```

**Expected Response:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "bets": [...],
    "pageNumber": 1,
    "pageSize": 10,
    "totalCount": 0,
    "totalPageNumber": 0
  }
}
```

---

## Test Script Configuration

Environment variables (optional):
- `MERCHANT_ID` - Merchant ID (default: `TEST_MERCHANT`)
- `HASH_KEY` - Merchant hash key (default: `dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=`)
- `API_BASE_URL` - API base URL (default: `http://localhost:4001`)

---

## Error Codes Reference

| Code | Description |
|------|-------------|
| 0 | Success |
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
