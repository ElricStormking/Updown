# Platform Integration API Documentation

**Version:** 1.0  
**Last Updated:** February 2026  

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Signature Generation](#signature-generation)
4. [Base URL](#base-url)
5. [Common Response Format](#common-response-format)
6. [Error Codes](#error-codes)
7. [API Endpoints](#api-endpoints)
   - [Create Account](#1-create-account)
   - [Transfer](#2-transfer)
   - [Get Bet History](#3-get-bet-history)
   - [Get Transfer History](#4-get-transfer-history)
   - [Launch Game](#5-launch-game)
   - [Update Bet Amount Limit](#6-update-bet-amount-limit)
   - [Update Token Values](#7-update-token-values)
8. [Data Types](#data-types)
9. [Code Examples](#code-examples)

---

## Overview

This document describes the Integration API for platform partners to integrate the Hi-Lo BTC game into their systems. The API allows partners to:

- Create player accounts
- Transfer funds into/out of player wallets
- Query bet history
- Query transfer history
- Launch the game with authenticated player sessions
- Configure bet amount limits and token values

All API endpoints use **HTTP POST** method and accept/return **JSON** payloads.

---

## Authentication

Every API request requires authentication through:

1. **Merchant ID** (`merchantId`): Your unique merchant identifier provided during onboarding
2. **Timestamp** (`timestamp`): Current Unix timestamp in seconds (10 digits)
3. **Signature** (`hash`): SHA256 hash of request parameters combined with your secret key

### Timestamp Validation

- The timestamp must be within **10 seconds** of the server's current time
- Timestamps outside this window will be rejected with error code `1002`

---

## Signature Generation

### Hash Key

Your hash key is a **32-character BASE64** string provided during merchant onboarding. Keep this secret and never expose it in client-side code.

### Signature Algorithm

```
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

**Steps:**
1. Concatenate all parameters (in the specified order for each API) with `&` separator
2. Append `&` followed by your `hashKey`
3. Compute SHA256 hash of the resulting string
4. Convert to lowercase hexadecimal string (64 characters)

### Example (JavaScript/Node.js)

```javascript
const crypto = require('crypto');

function generateSignature(params, hashKey) {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Example for AccountCreate
const merchantId = 'MERCHANT001';
const account = 'player123';
const timestamp = Math.floor(Date.now() / 1000);
const hashKey = 'your-32-char-secret-key-here!!!';

const hash = generateSignature([merchantId, account, timestamp.toString()], hashKey);
```

### Example (Python)

```python
import hashlib
import time

def generate_signature(params, hash_key):
    data = '&'.join(params) + '&' + hash_key
    return hashlib.sha256(data.encode()).hexdigest()

# Example for AccountCreate
merchant_id = 'MERCHANT001'
account = 'player123'
timestamp = int(time.time())
hash_key = 'your-32-char-secret-key-here!!!'

hash_value = generate_signature([merchant_id, account, str(timestamp)], hash_key)
```

### Example (Java)

```java
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

public String generateSignature(String[] params, String hashKey) {
    String data = String.join("&", params) + "&" + hashKey;
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
    StringBuilder hexString = new StringBuilder();
    for (byte b : hash) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
    }
    return hexString.toString();
}
```

---

## Base URL

| Environment | Base URL |
|------------|----------|
| Production | `https://api.your-game-domain.com` |
| Sandbox | `https://sandbox-api.your-game-domain.com` |

All endpoints are prefixed with `/integration/`

---

## Common Response Format

All API responses follow this structure:

```json
{
  "success": true | false,
  "errorCode": 0,
  "errorMessage": "",
  "data": { ... } | null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` if request succeeded, `false` otherwise |
| `errorCode` | integer | `0` on success, error code on failure |
| `errorMessage` | string | Empty on success, error description on failure |
| `data` | object/null | Response data on success, `null` on failure |

---

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| `0` | SUCCESS | Request completed successfully |
| `1001` | INVALID_SIGNATURE | Signature verification failed |
| `1002` | TIMESTAMP_EXPIRED | Timestamp is outside valid window (±10 seconds) |
| `1003` | MERCHANT_NOT_FOUND | Merchant ID not found in system |
| `1004` | MERCHANT_INACTIVE | Merchant account is deactivated |
| `2001` | ACCOUNT_ALREADY_EXISTS | Player account already exists |
| `2002` | ACCOUNT_NOT_FOUND | Player account not found |
| `3001` | INSUFFICIENT_BALANCE | Insufficient balance for withdrawal |
| `3002` | DUPLICATE_ORDER_NUMBER | Transfer order number already used |
| `3003` | INVALID_TRANSFER_TYPE | Invalid transfer type (must be 0 or 1) |
| `4001` | INVALID_PAGE_SIZE | Page size must be between 1 and 100 |
| `4002` | INVALID_PAGE_NUMBER | Page number must be >= 1 |
| `5001` | INVALID_BET_AMOUNT_LIMIT | Invalid bet amount limit |
| `5002` | INVALID_TOKEN_VALUES | Invalid token values |
| `9999` | INTERNAL_ERROR | Internal server error |

---

## API Endpoints

### 1. Create Account

Creates a new player account in the game system.

**Endpoint:** `POST /integration/account/create`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `account` | string | Yes | Unique player account identifier |
| `timestamp` | integer | Yes | Unix timestamp in seconds (10 digits) |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
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

**Success:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": null
}
```

**Failure (Account exists):**
```json
{
  "success": false,
  "errorCode": 2001,
  "errorMessage": "Account already exists",
  "data": null
}
```

---

### 2. Transfer

Transfer funds into or out of a player's game wallet.

**Endpoint:** `POST /integration/transfer`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `account` | string | Yes | Player account identifier |
| `orderNo` | string | Yes | Unique transfer order number (for idempotency) |
| `type` | integer | Yes | `0` = Deposit (into game), `1` = Withdrawal (out to merchant) |
| `amount` | number | Yes | Transfer amount (must be > 0) |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + account + "&" + type + "&" + amount + "&" + timestamp + "&" + hashKey)
```

#### Request Example (Deposit)

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "orderNo": "TXN20260202001",
  "type": 0,
  "amount": 100.00,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Request Example (Withdrawal)

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "orderNo": "TXN20260202002",
  "type": 1,
  "amount": 50.00,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### Response

**Success:**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "balance": 150.00
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Player's new balance after transfer |

**Failure (Insufficient balance):**
```json
{
  "success": false,
  "errorCode": 3001,
  "errorMessage": "Insufficient balance",
  "data": null
}
```

---

### 3. Get Bet History

Retrieve paginated bet history for your merchant's players.

**Endpoint:** `POST /integration/bets`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `startBetTime` | string | Yes | Start time filter (ISO 8601 UTC format) |
| `pageSize` | integer | Yes | Records per page (1-100) |
| `pageNumber` | integer | Yes | Page number (starts from 1) |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**Date Format for Signature:** `yyyyMMddHHmmssfff` (UTC)
- Example: `2026-02-02T10:30:00.123Z` → `20260202103000123`

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
        "amount": 10.00,
        "odds": 0.96,
        "result": "WIN",
        "payout": 19.60,
        "betTime": "2026-02-02T10:30:00.000Z",
        "lockedPrice": 75000.50,
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
| `id` | string | Unique bet identifier |
| `account` | string | Player account |
| `roundId` | integer | Game round ID |
| `betType` | string | `"DIGIT"` or `"HILO"` |
| `side` | string/null | `"UP"` or `"DOWN"` for HILO bets |
| `digitType` | string/null | Digit bet type (see [Digit Bet Types](#digit-bet-types)) |
| `selection` | string/null | Bet selection value |
| `amount` | number | Bet amount |
| `odds` | number | Payout multiplier |
| `result` | string | `"PENDING"`, `"WIN"`, `"LOSE"`, or `"REFUND"` |
| `payout` | number | Payout amount (0 if lost) |
| `betTime` | string | Bet placement time (ISO 8601) |
| `lockedPrice` | number/null | BTC price when round locked |
| `finalPrice` | number/null | BTC price when round ended |
| `winningSide` | string/null | `"UP"`, `"DOWN"`, or null (tie/push) |
| `digitResult` | string/null | 3-digit result (e.g., "025") |
| `digitSum` | integer/null | Sum of 3 digits (0-27) |

---

### 4. Get Transfer History

Retrieve paginated transfer history for your merchant.

**Endpoint:** `POST /integration/transfers`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `startTime` | string | Yes | Start time filter (ISO 8601 UTC format) |
| `pageSize` | integer | Yes | Records per page (1-100) |
| `pageNumber` | integer | Yes | Page number (starts from 1) |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**Date Format for Signature:** `yyyyMMddHHmmssfff` (UTC)

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
        "orderNo": "TXN20260202001",
        "type": 0,
        "amount": 100.00,
        "balanceAfter": 150.00,
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
| `id` | string | Unique transfer identifier |
| `account` | string | Player account |
| `orderNo` | string | Your transfer order number |
| `type` | integer | `0` = Deposit, `1` = Withdrawal |
| `amount` | number | Transfer amount |
| `balanceAfter` | number | Balance after transfer |
| `createdAt` | string | Transfer time (ISO 8601) |

---

### 5. Launch Game

Generate an authenticated game URL for a player.

**Endpoint:** `POST /integration/launch`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `account` | string | Yes | Player account identifier |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
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
  "data": {
    "url": "https://game.example.com?accessToken=eyJhbGciOiJIUzI1NiIs..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Game URL with JWT access token |

#### Usage

Open the returned URL in a browser or iframe to launch the game for the player. The access token is valid for 1 hour by default.

---

### 6. Update Bet Amount Limit

Update the maximum bet amount allowed per round for this merchant.
Default `maxBetAmount` is **5000** unless overridden.

**Endpoint:** `POST /integration/config/bet-limit`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `maxBetAmount` | number | Yes | Maximum amount a player can bet per round |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + maxBetAmount + "&" + timestamp + "&" + hashKey)
```

#### Request Example

```json
{
  "merchantId": "MERCHANT001",
  "maxBetAmount": 500,
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
    "minBetAmount": 1,
    "maxBetAmount": 500
  }
}
```

---

### 7. Update Token Values

Customize the 7 token values shown in the betting UI.

**Endpoint:** `POST /integration/config/token-values`

#### Request

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Your merchant ID |
| `tokenValues` | number[] | Yes | Array of 7 token values (order is left-to-right slots) |
| `timestamp` | integer | Yes | Unix timestamp in seconds |
| `hash` | string | Yes | Request signature |

**Signature Parameters (in order):**
```
hash = SHA256(merchantId + "&" + tokenValuesCSV + "&" + timestamp + "&" + hashKey)
```

Where `tokenValuesCSV` is the comma-joined string of the 7 values in the request order.

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

## Data Types

### Digit Bet Types

| Type | Description | Selection Required |
|------|-------------|-------------------|
| `SMALL` | Sum of digits is 0-13 | No |
| `BIG` | Sum of digits is 14-27 | No |
| `ODD` | Sum of digits is odd | No |
| `EVEN` | Sum of digits is even | No |
| `ANY_TRIPLE` | All 3 digits are the same | No |
| `DOUBLE` | Specific double (e.g., "00", "11") | Yes (`"00"` - `"99"`) |
| `TRIPLE` | Specific triple (e.g., "000", "111") | Yes (`"000"` - `"999"`) |
| `SUM` | Specific sum value | Yes (`"3"` - `"27"`) |
| `SINGLE` | Single digit appears at least once | Yes (`"0"` - `"9"`) |

### Bet Result Types

| Result | Description |
|--------|-------------|
| `PENDING` | Bet is active, round not finished |
| `WIN` | Player won |
| `LOSE` | Player lost |
| `REFUND` | Bet was refunded (round cancelled) |

---

## Code Examples

### Complete Integration Example (Node.js)

```javascript
const crypto = require('crypto');
const axios = require('axios');

class GameIntegration {
  constructor(merchantId, hashKey, baseUrl) {
    this.merchantId = merchantId;
    this.hashKey = hashKey;
    this.baseUrl = baseUrl;
  }

  generateSignature(params) {
    const data = params.join('&') + '&' + this.hashKey;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getTimestamp() {
    return Math.floor(Date.now() / 1000);
  }

  formatDateForSignature(date) {
    const pad = (n, len = 2) => n.toString().padStart(len, '0');
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      pad(date.getUTCMilliseconds(), 3)
    );
  }

  async createAccount(account) {
    const timestamp = this.getTimestamp();
    const hash = this.generateSignature([
      this.merchantId,
      account,
      timestamp.toString(),
    ]);

    const response = await axios.post(`${this.baseUrl}/integration/account/create`, {
      merchantId: this.merchantId,
      account,
      timestamp,
      hash,
    });

    return response.data;
  }

  async transfer(account, orderNo, type, amount) {
    const timestamp = this.getTimestamp();
    const hash = this.generateSignature([
      this.merchantId,
      account,
      type.toString(),
      amount.toString(),
      timestamp.toString(),
    ]);

    const response = await axios.post(`${this.baseUrl}/integration/transfer`, {
      merchantId: this.merchantId,
      account,
      orderNo,
      type,
      amount,
      timestamp,
      hash,
    });

    return response.data;
  }

  async getBetHistory(startBetTime, pageSize, pageNumber) {
    const timestamp = this.getTimestamp();
    const formattedTime = this.formatDateForSignature(new Date(startBetTime));
    const hash = this.generateSignature([
      this.merchantId,
      formattedTime,
      pageSize.toString(),
      pageNumber.toString(),
      timestamp.toString(),
    ]);

    const response = await axios.post(`${this.baseUrl}/integration/bets`, {
      merchantId: this.merchantId,
      startBetTime,
      pageSize,
      pageNumber,
      timestamp,
      hash,
    });

    return response.data;
  }

  async getTransferHistory(startTime, pageSize, pageNumber) {
    const timestamp = this.getTimestamp();
    const formattedTime = this.formatDateForSignature(new Date(startTime));
    const hash = this.generateSignature([
      this.merchantId,
      formattedTime,
      pageSize.toString(),
      pageNumber.toString(),
      timestamp.toString(),
    ]);

    const response = await axios.post(`${this.baseUrl}/integration/transfers`, {
      merchantId: this.merchantId,
      startTime,
      pageSize,
      pageNumber,
      timestamp,
      hash,
    });

    return response.data;
  }

  async launchGame(account) {
    const timestamp = this.getTimestamp();
    const hash = this.generateSignature([
      this.merchantId,
      account,
      timestamp.toString(),
    ]);

    const response = await axios.post(`${this.baseUrl}/integration/launch`, {
      merchantId: this.merchantId,
      account,
      timestamp,
      hash,
    });

    return response.data;
  }
}

// Usage Example
async function main() {
  const integration = new GameIntegration(
    'MERCHANT001',
    'your-32-char-secret-key-here!!!',
    'https://api.your-game-domain.com'
  );

  // Create account
  const createResult = await integration.createAccount('player123');
  console.log('Create Account:', createResult);

  // Deposit 100 USDT
  const depositResult = await integration.transfer(
    'player123',
    'DEP-' + Date.now(),
    0,
    100
  );
  console.log('Deposit:', depositResult);

  // Launch game
  const launchResult = await integration.launchGame('player123');
  console.log('Game URL:', launchResult.data?.url);

  // Get bet history
  const betsResult = await integration.getBetHistory(
    '2026-01-01T00:00:00.000Z',
    50,
    1
  );
  console.log('Bet History:', betsResult);

  // Withdraw 50 USDT
  const withdrawResult = await integration.transfer(
    'player123',
    'WDR-' + Date.now(),
    1,
    50
  );
  console.log('Withdrawal:', withdrawResult);
}

main().catch(console.error);
```

