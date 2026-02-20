# Platform Integration Service — Public API Specification

---

## Database

### Merchant Table (`Merchant`)

- **Merchant ID (`merchantId`)**: This value must be included in every API request.

- **Signature Key String (`hashKey`)**: Required for signing and verifying signatures when calling Merchant integration APIs.
  - The signature key is a 32-character BASE64 string.
  - Every API request described below must include a signature field.
  - **How to generate the signature field value**: Concatenate all request parameters into a string `A`, then append the `hashKey` to `A`, and compute the SHA256 hash of the resulting string.

---

### Other Tables

The following tables require a `merchantId` column to be added:

- `User`
- `Bet`

---

## Integration APIs

### Authentication Mechanism

- **Timestamp (`timestamp`) Check**: The submitted timestamp must be within 5–10 seconds before the time the server receives the request.

- **Signature Check**:
  - The signature generated from the received merchant request body must match the `hash` field included in the request.

---

### `AccountCreate` — Create a Player in the User Table

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | — | `null` |

---

### `Transfer` — Merchant Player Fund Transfer

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| `transferId` | Transfer order number |
| `type` | Transfer type: `0` = Transfer into game; `1` = Transfer out (back) to merchant |
| `amount` | Amount |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & type & amount & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the game-side balance; otherwise `null` |

```json
{
  "balance": 0
}
```

---

### `GetBetHistory` — Retrieve Historical Bet Records

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `startBetTime` | Bet start time (UTC string format: `yyyy-MM-ddTHH:mm:ss.fff`) |
| `pageSize` | Records per page (1–100) |
| `pageNumber` | Page number |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & startBetTime(format: yyyyMMddHHmmssfff) & pageSize & pageNumber & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns bet records; otherwise `null` |

```json
{
  "bets": [
    { /* single bet record */ },
    ...
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 100,
  "totalPageNumber": 5
}
```

> Records are sorted by `betTime`, with the most recent record appearing first on the first page.

---

### `GetTransferHistory` — Retrieve Transfer Records

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `startTime` | Transfer start time (UTC string format: `yyyy-MM-ddTHH:mm:ss.fff`) |
| `pageSize` | Records per page (1–100) |
| `pageNumber` | Page number |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & startTime(format: yyyyMMddHHmmssfff) & pageSize & pageNumber & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns transfer records; otherwise `null` |

```json
{
  "transfers": [
    { /* single transfer record */ },
    ...
  ],
  "pageNumber": 1,
  "pageSize": 20,
  "totalCount": 100,
  "totalPageNumber": 5
}
```

---

### `LaunchGame` — Login and Obtain Game Link (Including `accessToken`)

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `playerId` | Merchant-side player ID — used for verification in Callback APIs. Must be retained while the player is online until they go offline and all related callbacks are processed, or until the player calls `LaunchGame` again. |
| `account` | Player game account |
| `accessToken` | Merchant-side access token — used for verification in Callback APIs. Must be retained while the player is online until they go offline and all related callbacks are processed, or until the player calls `LaunchGame` again. |
| `betLimits` | Bet limits per game type (see below) |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**`betLimits` Object**

| Key | Example Value |
|-----|--------------|
| `bigSmall` | 1000 |
| `oddEven` | 2000 |
| `eachDouble` | 3000 |
| `eachTripple` | 4000 |
| `sum` | 5000 |
| `single` | 6000 |
| `anyTripple` | 7000 |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the game URL; otherwise `null` |

```json
{
  "url": "https://www.ehooray.com?accessToken={jwtToken}"
}
```

---

### `Callback: LoginPlayer`

**Purpose**

This API must be implemented on the **merchant's side** according to this specification so that the game platform can call it. Based on the sequence diagram provided to the merchant, the game platform will send a request to the merchant at the designated time to confirm successful login. A successful login screen is only shown after the merchant returns a success response.

**Configuration**

The merchant's settings must include the URL for this API so the game platform can call it at the appropriate time.

**Sequence Diagram**

![LoginPlayer Callback Sequence Diagram](image1.png)

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `playerId` | The `playerId` passed in during `LaunchGame`, for merchant-side verification |
| `account` | Player game account |
| `accessToken` | The `accessToken` passed in during `LaunchGame`, for merchant-side verification |
| `currency` | Currency value from the merchant settings — used for the merchant to verify correct currency configuration |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |

---

### `GetBetLimit` — Get Bet Limit Settings

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the merchant's bet limits; otherwise `null` |

```json
{
  "minBetAmount": 0,
  "maxBetAmount": 1000
}
```

---

### `SetBetLimit` — Configure Bet Limit Settings

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `minBetAmount` | Minimum bet amount |
| `maxBetAmount` | Maximum bet amount |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & minBetAmount & maxBetAmount & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the updated bet limits; otherwise `null` |

```json
{
  "minBetAmount": 0,
  "maxBetAmount": 1000
}
```

---

### `GetTokens` — Get Chip Denomination Settings

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the merchant's chip settings; otherwise `null` |

```json
{
  "tokenValues": [5, 10, 20, 50, 100, 200, 500]
}
```

---

### `SetTokens` — Configure Chip Denomination Settings

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `tokenValues` | Array of 7 chip denominations (ordered from left to right chip positions) |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & tokenValuesCSV & timestamp & hashKey)` |

> `tokenValuesCSV` is a comma-separated string of the 7 values in request order.

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the updated chip settings; otherwise `null` |

```json
{
  "tokenValues": [5, 10, 20, 50, 100, 200, 500]
}
```

---

### `AllTransferOut` — Transfer All Player Balance Back to Platform

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| `transferId` | Transfer order number |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
| `data` | object/null | When `success=true`, returns the game-side balance after transfer; otherwise `null` |

```json
{
  "balance": 0
}
```

---

### `Callback: UpdateBalance`

**Purpose**

This API must be implemented on the **merchant's side** according to this specification so that the game platform can call it. It is triggered when the system detects that a player has gone offline, notifying the merchant to transfer the player's remaining game balance back via the `Transfer` API.

**Configuration**

The merchant's settings must include the URL for this API so the game platform can call it at the appropriate time.

**Request**

| Field | Description |
|-------|-------------|
| `merchantId` | Merchant ID |
| `playerId` | The `playerId` passed in during `LaunchGame`, for merchant-side verification |
| `account` | Player game account |
| `accessToken` | The `accessToken` passed in during `LaunchGame`, for merchant-side verification |
| `currency` | Currency value from the merchant settings — used for the merchant to verify correct currency configuration |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` or `false` |
| `errorCode` | int | Error code: `0` when `success=true`; other codes when `success=false` |
| `errorMessage` | string | Description of the error when failed |
