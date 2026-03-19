# Hi-Lo Game Merchant Integration API Documentation

**Version:** 1.3  
**Last Updated:** March 10, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Merchant Onboarding](#merchant-onboarding)
3. [Base URL](#base-url)
4. [Authentication](#authentication)
5. [Signature Generation](#signature-generation)
6. [Common Response Format](#common-response-format)
7. [Error Codes](#error-codes)
8. [Merchant API Endpoints](#merchant-api-endpoints)
   - [Create Account](#1-create-account)
   - [Transfer](#2-transfer)
   - [Get Bet History](#3-get-bet-history)
   - [Get Transfer History](#4-get-transfer-history)
   - [Launch Game](#5-launch-game)
   - [All Transfer Out](#6-all-transfer-out)
   - [Get Token Values](#7-get-token-values)
   - [Set Token Values](#8-set-token-values)
9. [Merchant Callback Endpoints](#merchant-callback-endpoints)
   - [LoginPlayer Callback](#9-loginplayer-callback-merchant-side)
   - [UpdateBalance Callback](#10-updatebalance-callback-merchant-side)
10. [Data Types](#data-types)

---

## Overview

This document describes the merchant-facing API contract for integrating the Hi-Lo BTC game.

The integration supports:

- Player account creation
- Balance transfer into and out of the game
- Bet history query
- Transfer history query
- Game launch
- Transfer of all remaining player balance out of the game
- Merchant callback verification during login and balance settlement
- Token value configuration

All merchant API endpoints use **HTTP POST** and exchange **JSON** payloads.

---

## Merchant Onboarding

### Information Required from Merchant

- Merchant callback URL for `LoginPlayer`
- Merchant callback URL for `UpdateBalance`
- Source IP whitelist for merchant API requests
- Merchant currency

### Information Returned by Game Provider

- `merchantId`
- `hashKey`
- Provider callback source IPs for callback allowlisting

### Currency

Merchant currency is configured during onboarding and is used as the game currency for that merchant.

- Newly created player wallets use the merchant currency
- Callback payloads include the merchant currency
- Merchant-signed inbound API requests do **not** include a `currency` field

---

## Base URL

| Environment | Base URL |
|------------|----------|
| Production | `TBD` |
| Sandbox | `http://www.ehooray.ch:4000` |

All merchant API endpoints are prefixed with `/integration/`.

---

## Authentication

Every merchant API request must include:

1. `merchantId`
2. `timestamp`
3. `hash`
4. A caller IP that is present in the merchant whitelist

### Timestamp Rules

- `timestamp` uses Unix time in seconds
- Requests should be sent immediately after signature generation
- Future timestamps are rejected
- Requests outside the allowed time window are rejected with error `1002`

Use a tolerance target of about **10 seconds** unless the provider gives you a different value during onboarding.

---

## Signature Generation

### Algorithm

```text
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

### Rules

1. Concatenate parameters in the exact order defined for the endpoint
2. Join parameters with `&`
3. Append `&` and your `hashKey`
4. Compute the SHA256 digest
5. Send the lowercase hexadecimal result in `hash`

### JavaScript Example

```javascript
const crypto = require('crypto');

function generateSignature(params, hashKey) {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

### Python Example

```python
import hashlib

def generate_signature(params, hash_key):
    data = '&'.join(params) + '&' + hash_key
    return hashlib.sha256(data.encode()).hexdigest()
```

### Date Formatting for History APIs

`Get Bet History` and `Get Transfer History` use a formatted UTC date inside the signature:

```text
yyyyMMddHHmmssfff
```

Example:

```text
2026-02-01T00:00:00.123Z -> 20260201000000123
```

---

## Common Response Format

All merchant API responses use this structure:

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` on success, `false` on failure |
| `errorCode` | integer | `0` on success, otherwise a business error code |
| `errorMessage` | string | Empty on success, otherwise a message describing the failure |
| `data` | object/null | Response payload on success, otherwise `null` |

Merchant API endpoints return HTTP `200` for both success and business errors. Always check `success` and `errorCode`.

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| `0` | SUCCESS | Request completed successfully |
| `1001` | INVALID_SIGNATURE | Signature verification failed |
| `1002` | TIMESTAMP_EXPIRED | Timestamp is invalid or outside the allowed time window |
| `1003` | MERCHANT_NOT_FOUND | Merchant ID does not exist |
| `1004` | MERCHANT_INACTIVE | Merchant is inactive |
| `1005` | IP_NOT_ALLOWED | Caller IP is not allowlisted |
| `2001` | ACCOUNT_ALREADY_EXISTS | Account already exists |
| `2002` | ACCOUNT_NOT_FOUND | Account does not exist |
| `2003` | ACCOUNT_DISABLED | Account is disabled |
| `3001` | INSUFFICIENT_BALANCE | Balance is insufficient for transfer out |
| `3002` | DUPLICATE_ORDER_NUMBER | Transfer ID already exists |
| `3003` | INVALID_TRANSFER_TYPE | Transfer type must be `0` or `1` |
| `4001` | INVALID_PAGE_SIZE | `pageSize` must be between `1` and `100` |
| `4002` | INVALID_PAGE_NUMBER | `pageNumber` must be greater than or equal to `1` |
| `5001` | INVALID_BET_AMOUNT_LIMIT | Launch `betLimits` are invalid |
| `5002` | INVALID_TOKEN_VALUES | Token values are invalid |
| `6001` | CALLBACK_FIELDS_REQUIRED | `Launch Game` requires `playerId` and `accessToken` |
| `6002` | CALLBACK_MERCHANT_NOT_CONFIGURED | Merchant callback settings are incomplete |
| `9999` | INTERNAL_ERROR | Internal server error |

---

## Merchant API Endpoints

### 1. Create Account

Creates a player account in the game system.

**Endpoint:** `POST /integration/account/create`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `account` | string | Yes | Merchant-side player account identifier |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, account, timestamp
```

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": null
}
```

---

### 2. Transfer

Transfers balance into or out of a player's game wallet.

**Endpoint:** `POST /integration/transfer`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `account` | string | Yes | Player account |
| `transferId` | string | Conditional | Unique transfer identifier. Required if `orderNo` is not provided |
| `orderNo` | string | Conditional | Legacy alias of `transferId`. Required if `transferId` is not provided |
| `type` | integer | Yes | `0` = transfer into game, `1` = transfer out of game |
| `amount` | number | Yes | Transfer amount |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, account, type, amount, timestamp
```

`transferId` and `orderNo` are required for transfer identification, but are not part of the signature.

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "transferId": "TXN20260202001",
  "type": 0,
  "amount": 100,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "balance": 150
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Player balance after the transfer |

---

### 3. Get Bet History

Returns paginated bet history for the merchant.

**Endpoint:** `POST /integration/bets`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `startBetTime` | string | Yes | ISO 8601 UTC datetime |
| `pageSize` | integer | Yes | Number of records per page, `1` to `100` |
| `pageNumber` | integer | Yes | Page number, starting from `1` |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, formattedStartBetTime, pageSize, pageNumber, timestamp
```

`formattedStartBetTime` must use UTC format `yyyyMMddHHmmssfff`.

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "startBetTime": "2026-02-01T00:00:00.000Z",
  "pageSize": 50,
  "pageNumber": 1,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "bets": [
      {
        "id": "bet_abc123",
        "account": "player123",
        "roundId": 12345,
        "betType": "DIGIT",
        "side": null,
        "digitType": "SMALL",
        "selection": null,
        "amount": 10,
        "odds": 0.96,
        "result": "WIN",
        "payout": 19.6,
        "betTime": "2026-02-02T10:30:00.000Z",
        "lockedPrice": 75000.5,
        "finalPrice": 75010.25,
        "winningSide": "UP",
        "digitResult": "025",
        "digitSum": 7
      }
    ],
    "pageNumber": 1,
    "pageSize": 50,
    "totalCount": 125,
    "totalPageNumber": 3
  }
}
```

#### Bet History Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Bet identifier |
| `account` | string | Player account |
| `roundId` | integer | Game round ID |
| `betType` | string | `DIGIT` or `HILO` |
| `side` | string/null | `UP` or `DOWN` for HILO bets |
| `digitType` | string/null | Digit bet type |
| `selection` | string/null | Player selection |
| `amount` | number | Bet amount |
| `odds` | number | Odds multiplier |
| `result` | string | Bet result |
| `payout` | number | Payout amount |
| `betTime` | string | Bet time in ISO 8601 format |
| `lockedPrice` | number/null | Price at round lock |
| `finalPrice` | number/null | Price at round result |
| `winningSide` | string/null | Winning HILO side |
| `digitResult` | string/null | Three-digit result |
| `digitSum` | integer/null | Sum of the three digits |

---

### 4. Get Transfer History

Returns paginated transfer history for the merchant.

**Endpoint:** `POST /integration/transfers`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `startTime` | string | Yes | ISO 8601 UTC datetime |
| `pageSize` | integer | Yes | Number of records per page, `1` to `100` |
| `pageNumber` | integer | Yes | Page number, starting from `1` |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, formattedStartTime, pageSize, pageNumber, timestamp
```

`formattedStartTime` must use UTC format `yyyyMMddHHmmssfff`.

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "startTime": "2026-02-01T00:00:00.000Z",
  "pageSize": 50,
  "pageNumber": 1,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "transfers": [
      {
        "id": "TF1A2B3C4D",
        "account": "player123",
        "transferId": "TXN20260202001",
        "type": 0,
        "amount": 100,
        "balanceBefore": 50,
        "balanceAfter": 150,
        "createdAt": "2026-02-02T10:30:00.000Z"
      }
    ],
    "pageNumber": 1,
    "pageSize": 50,
    "totalCount": 42,
    "totalPageNumber": 1
  }
}
```

#### Transfer History Item Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Platform transfer identifier |
| `account` | string | Player account |
| `transferId` | string | Merchant transfer identifier |
| `type` | integer | `0` = in, `1` = out |
| `amount` | number | Transfer amount |
| `balanceBefore` | number | Balance before transfer |
| `balanceAfter` | number | Balance after transfer |
| `createdAt` | string | Transfer time in ISO 8601 format |

---

### 5. Launch Game

Generates a launch URL for a player.

**Endpoint:** `POST /integration/launch`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `account` | string | Yes | Player account |
| `playerId` | string | Yes | Merchant-side player identifier used in callbacks |
| `accessToken` | string | Yes | Merchant-side access token used in callbacks |
| `betLimits` | object | Yes | Per-rule bet limit object. All 7 rule groups are required |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, account, timestamp
```

#### Launch Flow

1. Merchant calls `Launch Game` and receives a game URL
2. Merchant opens or redirects the player to the returned URL
3. Platform calls the merchant `LoginPlayer` callback
4. Merchant verifies the callback and transfers balance into the game
5. When verification succeeds, the player enters the game

#### betLimits Rules

- All 7 rule groups are required
- Each rule must include both `minBetLimit` and `maxBetLimit`
- `minBetLimit` must be greater than or equal to `0`
- `maxBetLimit` must be greater than or equal to `0`
- `maxBetLimit` must be greater than or equal to `minBetLimit`

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "playerId": "merchant-player-789",
  "accessToken": "merchant-access-token-value",
  "betLimits": {
    "bigSmall": { "minBetLimit": 0, "maxBetLimit": 1000 },
    "oddEven": { "minBetLimit": 0, "maxBetLimit": 2000 },
    "eachDouble": { "minBetLimit": 0, "maxBetLimit": 3000 },
    "eachTripple": { "minBetLimit": 0, "maxBetLimit": 4000 },
    "sum": { "minBetLimit": 0, "maxBetLimit": 5000 },
    "single": { "minBetLimit": 0, "maxBetLimit": 6000 },
    "anyTripple": { "minBetLimit": 0, "maxBetLimit": 7000 }
  },
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "url": "https://game.example.com?accessToken=eyJhbGciOiJIUzI1NiIs...&merchantId=MERCHANT001"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Launch URL for the player |

---

### 6. All Transfer Out

Transfers all remaining player balance out of the game.

**Endpoint:** `POST /integration/all-transfer-out`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `account` | string | Yes | Player account |
| `transferId` | string | Yes | Unique transfer identifier |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, account, timestamp
```

`transferId` is required for transfer identification, but is not part of the signature.

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "transferId": "ALL-OUT-20260221-0001",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "transferAmount": 150,
    "balance": 0
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `transferAmount` | number | Amount transferred out to the platform from the game wallet |
| `balance` | number | Remaining balance after transfer-out completes |

---

### 7. Get Token Values

Returns the 7 token values shown in the betting UI.

**Endpoint:** `POST /integration/config/token-values/get`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, timestamp
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "tokenValues": [5, 10, 20, 50, 100, 200, 500]
  }
}
```

---

### 8. Set Token Values

Updates the 7 token values shown in the betting UI.

**Endpoint:** `POST /integration/config/token-values`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `tokenValues` | number[] | Yes | Array of exactly 7 token values |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Rules

- `tokenValues` must contain exactly 7 numbers
- Every value must be greater than `0`
- The lowest token value must be greater than or equal to the current minimum bet amount

#### Signature Parameters

```text
merchantId, tokenValuesCSV, timestamp
```

Example:

```text
tokenValuesCSV = 5,10,20,50,100,200,500
```

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "tokenValues": [5, 10, 20, 50, 100, 200, 500],
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "tokenValues": [5, 10, 20, 50, 100, 200, 500]
  }
}
```

---

## Merchant Callback Endpoints

Merchants must implement the following callback endpoints and allow requests from the provider callback source IPs.

### 9. LoginPlayer Callback (Merchant Side)

Platform calls this callback when validating a player launch.

#### Purpose

- Verify `playerId`, `account`, and `accessToken`
- Verify that `currency` matches the merchant currency expected by your platform
- Transfer the player's balance into the game, usually by calling `POST /integration/transfer` with `type = 0`
- Return success when the player is allowed to enter the game

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `playerId` | string | Yes | Merchant-side player ID from `Launch Game` |
| `account` | string | Yes | Player account |
| `accessToken` | string | Yes | Merchant-side access token from `Launch Game` |
| `currency` | string | Yes | Merchant currency configured during onboarding |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, timestamp
```

#### Response

Return HTTP `200` with JSON:

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": ""
}
```

If verification fails, return:

```json
{
  "success": false,
  "errorCode": 1,
  "errorMessage": "Verification failed"
}
```

---

### 10. UpdateBalance Callback (Merchant Side)

Platform calls this callback when merchant-side balance settlement is required.

#### Purpose

- Verify `playerId`, `account`, and `accessToken`
- Verify that `currency` matches the merchant currency expected by your platform
- Settle the player's remaining balance out of the game
- The recommended settlement API is `POST /integration/all-transfer-out`
- The callback is sent after the offline grace period and only after any `RESULT_PENDING` round involving that player has settled

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |
| `playerId` | string | Yes | Merchant-side player ID from `Launch Game` |
| `account` | string | Yes | Player account |
| `accessToken` | string | Yes | Merchant-side access token from `Launch Game` |
| `currency` | string | Yes | Merchant currency configured during onboarding |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

#### Signature Parameters

```text
merchantId, timestamp
```

#### Response

Return HTTP `200` with JSON:

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": ""
}
```

If settlement fails, return:

```json
{
  "success": false,
  "errorCode": 1,
  "errorMessage": "Settlement failed"
}
```

---

## Data Types

### Launch betLimits Object

`Launch Game` requires all of the following keys:

| Key | Description |
|-----|-------------|
| `bigSmall` | BIG / SMALL |
| `oddEven` | ODD / EVEN |
| `eachDouble` | Each DOUBLE |
| `eachTripple` | Each TRIPLE |
| `sum` | SUM |
| `single` | SINGLE |
| `anyTripple` | ANY TRIPLE |

Each key must contain:

| Field | Type | Description |
|-------|------|-------------|
| `minBetLimit` | number | Minimum allowed bet for the rule |
| `maxBetLimit` | number | Maximum allowed bet for the rule |

Example:

```json
{
  "bigSmall": { "minBetLimit": 0, "maxBetLimit": 1000 },
  "oddEven": { "minBetLimit": 0, "maxBetLimit": 2000 },
  "eachDouble": { "minBetLimit": 0, "maxBetLimit": 3000 },
  "eachTripple": { "minBetLimit": 0, "maxBetLimit": 4000 },
  "sum": { "minBetLimit": 0, "maxBetLimit": 5000 },
  "single": { "minBetLimit": 0, "maxBetLimit": 6000 },
  "anyTripple": { "minBetLimit": 0, "maxBetLimit": 7000 }
}
```

### Digit Bet Types

| Value | Description |
|-------|-------------|
| `BIG` | Digit result 5-9 |
| `SMALL` | Digit result 0-4 |
| `ODD` | Odd digit result |
| `EVEN` | Even digit result |
| `DOUBLE` | Any two digits are the same |
| `TRIPLE` | All three digits are the same |
| `SUM` | Sum-based digit bet |
| `SINGLE` | Exact single-digit selection |
| `ANY_TRIPLE` | Any triple result |

### Bet Result Types

| Value | Description |
|-------|-------------|
| `PENDING` | Bet is not settled yet |
| `WIN` | Bet won |
| `LOSE` | Bet lost |
| `REFUND` | Bet was refunded |
