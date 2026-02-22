# Platform Integration Service - Test Plan (v1.1)

## Prerequisites

1. Gateway running on port `4000` with `/integration/*` routed to `hi-lo-merchant`.
2. Latest migration applied and Prisma client generated.
3. Test merchant seeded.
4. For callback-mode tests, callback URLs configured for the merchant.

## Setup

### 1. Apply migration and seed data

```bash
cd hi-lo-server
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

Seeded test merchant defaults:
- `merchantId`: `TEST_MERCHANT`
- `hashKey`: `dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=`
- `callbackEnabled`: `false` (legacy mode by default)

### 2. Start services

```bash
# in separate terminals
cd hi-lo-server && npm run start:dev
cd hi-lo-admin && npm run start:dev
cd hi-lo-merchant && npm run start:dev
cd .. && npm run start:gateway
```

### 3. Start optional mock callback merchant (for callback-mode)

```bash
cd hi-lo-server
npx ts-node Test-scripts/mock-merchant-callback-server.ts
```

Mock callback routes:
- `POST http://localhost:4100/login-player`
- `POST http://localhost:4100/update-balance`

## Test helper scripts

Primary helper script:
- `hi-lo-server/Test-scripts/test-integration-api.ts`

### Core command examples

```powershell
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "create-account" "player001"
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "transfer-in" "player001" "100" "ORDER001"
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "launch" "player001"
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "launch-callback" "player001" "pid-001" "merchantToken001"
& npx ts-node "D:\ProjectUpDown\hi-lo-server\Test-scripts\test-integration-api.ts" "all-transfer-out" "player001" "ORDER999"
```

## Validation scenarios

### A. Backward compatibility (callback disabled)

1. Keep `callbackEnabled=false`.
2. Call `launch`.
3. Verify:
- API returns success with URL.
- Client launch proceeds without callback preflight blocking.

### B. Callback-mode launch success

1. Enable merchant callback config in admin data:
- `callbackEnabled=true`
- `loginPlayerCallbackUrl=http://localhost:4100/login-player`
- `updateBalanceCallbackUrl=http://localhost:4100/update-balance`
2. Call `launch-callback`.
3. Open returned game URL in browser.
4. Verify:
- Client shows `Verifying launch with merchant...`.
- `POST /integration/launch/session/start` returns `ready=true`.
- Client continues and authenticates socket.
- `PlayerLogin` record is created.

### C. Callback-mode launch failure/timeout

1. Stop mock callback server or force fail:
- `FAIL_LOGIN=true npx ts-node Test-scripts/mock-merchant-callback-server.ts`
2. Launch using callback mode.
3. Verify:
- Preflight returns `ready=false` with 6xxx code/message.
- Client shows blocked/failure status.
- Gameplay socket is not connected.

### D. AllTransferOut behavior

1. Deposit player balance.
2. Call `all-transfer-out`.
3. Verify:
- Full balance is transferred out.
- Response `data.balance` is `0`.
- Duplicate `transferId` returns `DUPLICATE_ORDER_NUMBER`.

### E. UpdateBalance callback on offline trigger

1. Successful callback-mode launch and socket auth.
2. Disconnect last game socket and wait past grace window.
3. Verify:
- Server sends one `UpdateBalance` callback flow.
- Launch session offline status updates to sent/failed.
- Reconnect within grace window does not trigger callback.

### F. Session lifecycle

1. Launch callback mode twice for same merchant/user.
2. Verify previous active session becomes `SUPERSEDED`.
3. Verify superseded session does not emit `UpdateBalance`.

### G. Bet limit mapping (`betLimits`)

1. Call launch with `betLimits`.
2. Verify mapped merchant config updates:
- `bigSmall -> smallBig.max`
- `oddEven -> oddEven.max`
- `eachDouble -> double.max`
- `eachTripple -> triple.max`
- `sum -> sum.max`
- `single -> single.max`
- `anyTripple -> anyTriple.max`
3. Verify legacy override fields still take precedence if sent together.

## Environment variables for scripts

- `MERCHANT_ID` (default `TEST_MERCHANT`)
- `HASH_KEY` (default `dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=`)
- `API_BASE_URL` (default `http://localhost:4000`)
- `PORT` / `FAIL_LOGIN` / `FAIL_UPDATE` (mock callback script)

## Error codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1001 | Invalid signature |
| 1002 | Timestamp expired |
| 1003 | Merchant not found |
| 1004 | Merchant inactive |
| 2001 | Account already exists |
| 2002 | Account not found |
| 2003 | Account disabled |
| 3001 | Insufficient balance |
| 3002 | Duplicate order number |
| 3003 | Invalid transfer type |
| 5001 | Invalid bet amount limit |
| 5002 | Invalid token values |
| 6001 | Callback fields required |
| 6002 | Callback merchant not configured |
| 6003 | Launch session not found |
| 6004 | Launch session not active |
| 6005 | LoginPlayer callback failed |
| 6006 | UpdateBalance callback failed |
| 9999 | Internal error |
