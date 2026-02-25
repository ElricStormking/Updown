# Platform Integration Service (Standard Specification)

## Integration Application & Activation

### Information Required from Merchant Before Account Creation

- Currency code

- Default bet limit settings for each game type:

  - `maxBetLimit` (Global limit: no game type may exceed this value)

  - `minBetLimit` (Global limit: no game type may go below this value)

  - `bigSmall`
    - `maxBetLimit`
    - `minBetLimit`

  - `oddEven`
    - `maxBetLimit`
    - `minBetLimit`

  - `eachDouble`
    - `maxBetLimit`
    - `minBetLimit`

  - `eachTripple`
    - `maxBetLimit`
    - `minBetLimit`

  - `sum`
    - `maxBetLimit`
    - `minBetLimit`

  - `single`
    - `maxBetLimit`
    - `minBetLimit`

  - `anyTripple`
    - `maxBetLimit`
    - `minBetLimit`

- Callback URLs:
  - `LoginPlayer`: e.g. `https://merchant.example.com/login-player`
  - `UpdateBalance`: e.g. `https://merchant.example.com/update-balance`

- IP Whitelist: All source server IPs that will call the integration API, so the game provider can grant access.

---

### Integration Information Provided by Game Provider After Account Creation

- Merchant ID (`Merchant Id`)
- Hash Key (`Hash Key`)
- IP Whitelist: All source server IPs that will call the merchant's Callback URLs — the merchant must whitelist these IPs upon receipt.

---

## Database

### Merchant Table

- **Merchant ID** (`merchantId`): This value must be sent with every API call.

- **Hash Key** (`hashKey`): Required for signing and verifying requests to the merchant integration API. One hash key is stored per merchant.

  - The hash key is a 32-character BASE64 string.
  - Every API request described below must include a signature field.
  - **How to generate the signature**: Concatenate the request parameters into a string `A`, then append the hash key to `A`, and compute the SHA256 hash of the combined string.

### Other Tables

The following tables require an additional `merchantId` column:

- `User`
- `Bet`

---

## Integration APIs

### Authentication Mechanism

- **Timestamp check** (`timestamp`): The submitted timestamp must be within 5–10 seconds before the time the request is received.

- **Signature check**:
  - Generate a signature from the received merchant request content and compare it against the `hash` field in the request — they must match.

---

### AccountCreate — Create a Player in the User Table

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | null | Always `null` |

---

### Transfer — Merchant Player Transfer

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| Transfer order number | Unique transfer reference |
| `type` | `0` = Transfer in to game; `1` = Transfer out (back) to merchant |
| `amount` | Transfer amount |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & type & amount & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the game-side balance; otherwise `null` |

```json
{
  "balance": 0
}
```

---

### GetBetHistory — Retrieve Historical Bet Records

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `startBetTime` | Bet start time in UTC string format: `yyyy-MM-ddTHH:mm:ss.fff` |
| `pageSize` | Records per page (1–100) |
| `pageNumber` | Page number |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & startBetTime(yyyyMMddHHmmssfff) & pageSize & pageNumber & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns bet records; otherwise `null` |

```json
{
  "bets": [
    { /* single bet record */ },
    ...
  ],
  "pageNumber": 1,
  "pageSize": 10,
  "totalCount": 100,
  "totalPageNumber": 10
}
```

> Records are sorted by `betTime`, with the most recent appearing first on the first page.

---

### GetTransferHistory — Transfer Records

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `startTime` | Transfer start time in UTC string format: `yyyy-MM-ddTHH:mm:ss.fff` |
| `pageSize` | Records per page (1–100) |
| `pageNumber` | Page number |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & startTime(yyyyMMddHHmmssfff) & pageSize & pageNumber & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns transfer records; otherwise `null` |

```json
{
  "transfers": [
    { /* transfer record */ },
    ...
  ],
  "pageNumber": 1,
  "pageSize": 10,
  "totalCount": 100,
  "totalPageNumber": 10
}
```

---

### LaunchGame — Login and Retrieve Game URL (with accessToken)

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `playerId` | Merchant player ID — used to return to the merchant for verification in callback APIs. Must be stored while the player is online for callbacks to use, and only discarded after the player goes offline and all related callbacks are processed, or when the player re-launches the game. |
| `account` | Player game account |
| `accessToken` | Merchant-side access token — returned to the merchant for verification in callback APIs. Same retention rules as `playerId`. |
| `betLimits` | Bet limits per game type (example values): `bigSmall: 1000`, `oddEven: 2000`, `eachDouble: 3000`, `eachTripple: 4000`, `sum: 5000`, `single: 6000`, `anyTripple: 7000` |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the game URL; otherwise `null` |

```json
{
  "url": "https://www.ehooray.com?accessToken={jwtToken}"
}
```

---

### Callback: LoginPlayer

**Purpose**: This API is developed by the merchant on their side, and is called by the game provider according to the sequence diagram provided. The game provider calls this at the appropriate time to verify login — a successful response from the merchant is required before the login screen is shown.

**Setup**: The merchant's configuration must include the URL of this API so the game provider can call it at the appropriate time.

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `playerId` | The `playerId` passed by the merchant in `LaunchGame`, for merchant verification |
| `account` | Player game account |
| `accessToken` | The `accessToken` passed by the merchant in `LaunchGame`, for merchant verification |
| `currency` | Currency value from the merchant configuration — used so the merchant can verify the currency setting is correct |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |

---

### GetBetLimit — Retrieve Bet Limit Settings

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the merchant's bet limits; otherwise `null` |

```json
{
  "minBetAmount": 0,
  "maxBetAmount": 1000
}
```

---

### SetBetLimit — Set Bet Limits

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `minBetAmount` | Minimum bet amount |
| `maxBetAmount` | Maximum bet amount |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & minBetAmount & maxBetAmount & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the updated bet limits; otherwise `null` |

```json
{
  "minBetAmount": 0,
  "maxBetAmount": 1000
}
```

---

### GetTokens — Retrieve Chip Configuration

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the merchant's chip configuration; otherwise `null` |

```json
{
  "tokenValues": [5, 10, 20, 50, 100, 200, 500]
}
```

---

### SetTokens — Set Chip Configuration

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `tokenValues` | Array of 7 chip denominations (ordered from left to right by chip position) |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & tokenValuesCSV & timestamp & hashKey)` |

> `tokenValuesCSV`: The 7 values joined by commas in request order (e.g. `5,10,20,50,100,200,500`).

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the updated chip configuration; otherwise `null` |

```json
{
  "tokenValues": [5, 10, 20, 50, 100, 200, 500]
}
```

---

### AllTransferOut — Transfer All Merchant Player Balance Back to Platform

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `account` | Player game account |
| Transfer order number | Unique transfer reference |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & account & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
| `data` | object / null | When `success=true`, returns the game-side balance; otherwise `null` |

```json
{
  "balance": 0
}
```

---

### Callback: UpdateBalance

**Purpose**: This API is developed by the merchant on their side and called by the game provider. It is triggered when the system detects that a player has gone offline, notifying the merchant to use the `Transfer` API to transfer the player's remaining game balance back to the merchant platform.

**Setup**: The merchant's configuration must include the URL of this API so the game provider can call it at the appropriate time.

**Request**

| Field | Description |
|---|---|
| `merchantId` | Merchant ID |
| `playerId` | The `playerId` passed by the merchant in `LaunchGame`, for merchant verification |
| `account` | Player game account |
| `accessToken` | The `accessToken` passed by the merchant in `LaunchGame`, for merchant verification |
| `currency` | Currency value from the merchant configuration — used so the merchant can verify the currency setting is correct |
| `timestamp` | Unix timestamp in seconds (10 digits) |
| `hash` | `SHA256_HASH(merchantId & timestamp & hashKey)` |

**Response**

| Field | Type | Description |
|---|---|---|
| `success` | bool | `true` or `false` |
| `errorCode` | int | Error code; `0` when `success=true`, otherwise another code |
| `errorMessage` | string | Error description when `success=false` |
