# COMBI3 遊戲商戶整合 API 文件

**版本：** 1.3  
**最後更新：** 2026 年 3 月 10 日

---

## 目錄

1. [概述](#概述)
2. [商戶接入設定](#商戶接入設定)
3. [Base URL](#base-url)
4. [驗證機制](#驗證機制)
5. [簽章產生方式](#簽章產生方式)
6. [通用回應格式](#通用回應格式)
7. [錯誤碼](#錯誤碼)
8. [商戶 API 端點](#商戶-api-端點)
   - [建立帳號（Create Account）](#1-建立帳號create-account)
   - [轉帳（Transfer）](#2-轉帳transfer)
   - [取得投注歷史（Get Bet History）](#3-取得投注歷史get-bet-history)
   - [取得轉帳歷史（Get Transfer History）](#4-取得轉帳歷史get-transfer-history)
   - [啟動遊戲（Launch Game）](#5-啟動遊戲launch-game)
   - [全部轉出（All Transfer Out）](#6-全部轉出all-transfer-out)
   - [取得籌碼面額（Get Token Values）](#7-取得籌碼面額get-token-values)
   - [設定籌碼面額（Set Token Values）](#8-設定籌碼面額set-token-values)
9. [商戶回呼端點](#商戶回呼端點)
   - [LoginPlayer 回呼（商戶端）](#9-loginplayer-回呼商戶端)
   - [UpdateBalance 回呼（商戶端）](#10-updatebalance-回呼商戶端)
10. [資料型別](#資料型別)

---

## 概述

本文件說明 COMBI 3 遊戲對外提供給商戶的整合 API 規格。

整合內容包含：

- 建立玩家帳號
- 將資金轉入或轉出遊戲
- 查詢投注歷史
- 查詢轉帳歷史
- 啟動遊戲
- 將玩家在遊戲中的剩餘餘額全部轉出
- 於登入與餘額結算流程中支援商戶回呼驗證
- 設定籌碼面額

所有商戶 API 端點皆使用 **HTTP POST**，請求與回應皆為 **JSON**。

---

## 商戶接入設定

### 商戶需提供的資訊

- `LoginPlayer` 回呼 URL
- `UpdateBalance` 回呼 URL
- 商戶呼叫 API 的來源 IP 白名單
- 商戶幣別

### 遊戲提供方會提供的資訊

- `merchantId`
- `hashKey`
- 供商戶回呼端點設定白名單的來源 IP

### 幣別

商戶幣別會在接入時設定，並作為該商戶在遊戲中的使用幣別。

- 新建立的玩家錢包會使用該商戶幣別
- 回呼 payload 會包含該商戶幣別
- 商戶簽章的入站 API 請求**不需要**傳 `currency`

---

## Base URL

| 環境 | Base URL |
|------|----------|
| 正式環境 | `TBD` |
| 測試環境 | `http://www.ehooray.ch:4000` |

所有商戶 API 端點都會以 `/integration/` 為前綴。

---

## 驗證機制

每一個商戶 API 請求都必須包含：

1. `merchantId`
2. `timestamp`
3. `hash`
4. 位於商戶白名單中的來源 IP

### Timestamp 規則

- `timestamp` 使用 Unix 秒級時間戳
- 請在產生簽章後立即送出請求
- 未來時間戳會被拒絕
- 超出允許時間範圍的請求會回傳錯誤碼 `1002`

除非接入時另有約定，否則請以約 **10 秒** 的容許時間視窗實作。

---

## 簽章產生方式

### 演算法

```text
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

### 規則

1. 依各端點規定的參數順序串接
2. 參數之間以 `&` 連接
3. 最後再接上 `&` 與 `hashKey`
4. 計算 SHA256
5. 將結果以小寫十六進位字串放入 `hash`

### JavaScript 範例

```javascript
const crypto = require('crypto');

function generateSignature(params, hashKey) {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

### Python 範例

```python
import hashlib

def generate_signature(params, hash_key):
    data = '&'.join(params) + '&' + hash_key
    return hashlib.sha256(data.encode()).hexdigest()
```

### 歷史查詢 API 的日期格式

`Get Bet History` 與 `Get Transfer History` 在簽章時會使用格式化後的 UTC 日期：

```text
yyyyMMddHHmmssfff
```

範例：

```text
2026-02-01T00:00:00.123Z -> 20260201000000123
```

---

## 通用回應格式

所有商戶 API 的回應皆使用以下格式：

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {}
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `success` | boolean | 成功時為 `true`，失敗時為 `false` |
| `errorCode` | integer | 成功時為 `0`，失敗時為對應錯誤碼 |
| `errorMessage` | string | 成功時為空字串，失敗時為錯誤訊息 |
| `data` | object/null | 成功時的回傳資料，失敗時為 `null` |

商戶 API 即使發生業務錯誤，也會回傳 HTTP `200`。請以 `success` 與 `errorCode` 判斷結果。

---

## 錯誤碼

| 錯誤碼 | 名稱 | 說明 |
|--------|------|------|
| `0` | SUCCESS | 請求成功 |
| `1001` | INVALID_SIGNATURE | 簽章驗證失敗 |
| `1002` | TIMESTAMP_EXPIRED | `timestamp` 無效或超出允許時間範圍 |
| `1003` | MERCHANT_NOT_FOUND | 找不到 `merchantId` |
| `1004` | MERCHANT_INACTIVE | 商戶已停用 |
| `1005` | IP_NOT_ALLOWED | 來源 IP 不在白名單中 |
| `2001` | ACCOUNT_ALREADY_EXISTS | 帳號已存在 |
| `2002` | ACCOUNT_NOT_FOUND | 帳號不存在 |
| `2003` | ACCOUNT_DISABLED | 帳號已停用 |
| `3001` | INSUFFICIENT_BALANCE | 轉出時餘額不足 |
| `3002` | DUPLICATE_ORDER_NUMBER | `transferId` 已存在 |
| `3003` | INVALID_TRANSFER_TYPE | `type` 必須為 `0` 或 `1` |
| `4001` | INVALID_PAGE_SIZE | `pageSize` 必須介於 `1` 到 `100` |
| `4002` | INVALID_PAGE_NUMBER | `pageNumber` 必須大於或等於 `1` |
| `5001` | INVALID_BET_AMOUNT_LIMIT | `Launch Game` 的 `betLimits` 無效 |
| `5002` | INVALID_TOKEN_VALUES | `tokenValues` 無效 |
| `6001` | CALLBACK_FIELDS_REQUIRED | `Launch Game` 需要提供 `playerId` 與 `accessToken` |
| `6002` | CALLBACK_MERCHANT_NOT_CONFIGURED | 商戶回呼設定不完整 |
| `9999` | INTERNAL_ERROR | 內部伺服器錯誤 |

---

## 商戶 API 端點

### 1. 建立帳號（Create Account）

在遊戲系統中建立玩家帳號。

**Endpoint:** `POST /integration/account/create`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `account` | string | 是 | 商戶端玩家帳號識別值 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

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

### 2. 轉帳（Transfer）

將資金轉入或轉出玩家的遊戲錢包。

**Endpoint:** `POST /integration/transfer`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `account` | string | 是 | 玩家帳號 |
| `transferId` | string | 條件必填 | 唯一轉帳識別值。若未提供 `orderNo`，則必填 |
| `orderNo` | string | 條件必填 | `transferId` 的舊欄位別名。若未提供 `transferId`，則必填 |
| `type` | integer | 是 | `0` = 轉入遊戲，`1` = 轉出遊戲 |
| `amount` | number | 是 | 轉帳金額 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, account, type, amount, timestamp
```

`transferId` 與 `orderNo` 用於轉帳識別，但不納入簽章計算。

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

| 欄位 | 型別 | 說明 |
|------|------|------|
| `balance` | number | 轉帳後玩家餘額 |

---

### 3. 取得投注歷史（Get Bet History）

回傳商戶名下玩家的分頁投注歷史。

**Endpoint:** `POST /integration/bets`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `startBetTime` | string | 是 | ISO 8601 UTC 時間 |
| `pageSize` | integer | 是 | 每頁筆數，介於 `1` 到 `100` |
| `pageNumber` | integer | 是 | 頁碼，從 `1` 開始 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, formattedStartBetTime, pageSize, pageNumber, timestamp
```

`formattedStartBetTime` 必須使用 UTC 格式 `yyyyMMddHHmmssfff`。

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

#### 投注資料欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 投注識別值 |
| `account` | string | 玩家帳號 |
| `roundId` | integer | 遊戲回合 ID |
| `betType` | string | `DIGIT` 或 `HILO` |
| `side` | string/null | HILO 下注時為 `UP` 或 `DOWN` |
| `digitType` | string/null | 數字玩法類型 |
| `selection` | string/null | 玩家選擇值 |
| `amount` | number | 投注金額 |
| `odds` | number | 賠率倍數 |
| `result` | string | 投注結果 |
| `payout` | number | 派彩金額 |
| `betTime` | string | ISO 8601 格式的投注時間 |
| `lockedPrice` | number/null | 封盤時價格 |
| `finalPrice` | number/null | 結算時價格 |
| `winningSide` | string/null | HILO 獲勝方向 |
| `digitResult` | string/null | 三位數結果 |
| `digitSum` | integer/null | 三位數字總和 |

---

### 4. 取得轉帳歷史（Get Transfer History）

回傳商戶的分頁轉帳歷史。

**Endpoint:** `POST /integration/transfers`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `startTime` | string | 是 | ISO 8601 UTC 時間 |
| `pageSize` | integer | 是 | 每頁筆數，介於 `1` 到 `100` |
| `pageNumber` | integer | 是 | 頁碼，從 `1` 開始 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, formattedStartTime, pageSize, pageNumber, timestamp
```

`formattedStartTime` 必須使用 UTC 格式 `yyyyMMddHHmmssfff`。

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

#### 轉帳資料欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 平台端轉帳識別值 |
| `account` | string | 玩家帳號 |
| `transferId` | string | 商戶端轉帳識別值 |
| `type` | integer | `0` = 轉入，`1` = 轉出 |
| `amount` | number | 轉帳金額 |
| `balanceBefore` | number | 轉帳前餘額 |
| `balanceAfter` | number | 轉帳後餘額 |
| `createdAt` | string | ISO 8601 格式的轉帳時間 |

---

### 5. 啟動遊戲（Launch Game）

為玩家產生遊戲啟動 URL。

**Endpoint:** `POST /integration/launch`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `account` | string | 是 | 玩家帳號 |
| `playerId` | string | 是 | 用於回呼驗證的商戶端玩家 ID |
| `accessToken` | string | 是 | 用於回呼驗證的商戶端 access token |
| `betLimits` | object | 是 | 各玩法的投注限制物件，7 組規則都必須提供 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, account, timestamp
```

#### 啟動流程

1. 商戶呼叫 `Launch Game` 取得遊戲 URL
2. 商戶將玩家導向或開啟該 URL
3. 平台會呼叫商戶的 `LoginPlayer` 回呼
4. 商戶驗證回呼後，將玩家餘額轉入遊戲
5. 驗證成功後，玩家即可進入遊戲

#### betLimits 規則

- 7 組規則必須全部提供
- 每一組規則都必須同時包含 `minBetLimit` 與 `maxBetLimit`
- `minBetLimit` 必須大於或等於 `0`
- `maxBetLimit` 必須大於或等於 `0`
- `maxBetLimit` 必須大於或等於 `minBetLimit`

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

| 欄位 | 型別 | 說明 |
|------|------|------|
| `url` | string | 提供給玩家開啟的遊戲 URL |

---

### 6. 全部轉出（All Transfer Out）

將玩家在遊戲中的剩餘餘額全部轉出。

**Endpoint:** `POST /integration/all-transfer-out`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `account` | string | 是 | 玩家帳號 |
| `transferId` | string | 是 | 唯一轉帳識別值 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, account, timestamp
```

`transferId` 用於轉帳識別，但不納入簽章計算。

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

| 欄位 | 型別 | 說明 |
|------|------|------|
| `transferAmount` | number | 從遊戲錢包轉出回商戶平台的金額 |
| `balance` | number | 全部轉出完成後的剩餘餘額 |

---

### 7. 取得籌碼面額（Get Token Values）

取得投注介面上顯示的 7 個籌碼面額。

**Endpoint:** `POST /integration/config/token-values/get`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

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

### 8. 設定籌碼面額（Set Token Values）

更新投注介面上顯示的 7 個籌碼面額。

**Endpoint:** `POST /integration/config/token-values`

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `tokenValues` | number[] | 是 | 固定 7 個數值的陣列 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 規則

- `tokenValues` 必須剛好有 7 個數值
- 每個數值都必須大於 `0`
- 最小的籌碼面額必須大於或等於目前的最小下注金額

#### 簽章參數順序

```text
merchantId, tokenValuesCSV, timestamp
```

範例：

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

## 商戶回呼端點

商戶必須實作以下回呼端點，並允許遊戲提供方的回呼來源 IP。

### 9. LoginPlayer 回呼（商戶端）

平台會在驗證玩家啟動遊戲時呼叫此回呼。

#### 用途

- 驗證 `playerId`、`account` 與 `accessToken`
- 驗證 `currency` 是否與商戶平台預期幣別一致
- 將玩家餘額轉入遊戲，通常是呼叫 `POST /integration/transfer` 並使用 `type = 0`
- 玩家可進入遊戲時，回傳成功

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `playerId` | string | 是 | `Launch Game` 傳入的商戶端玩家 ID |
| `account` | string | 是 | 玩家帳號 |
| `accessToken` | string | 是 | `Launch Game` 傳入的商戶端 access token |
| `currency` | string | 是 | 接入時設定的商戶幣別 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, timestamp
```

#### Response

請回傳 HTTP `200`，JSON 格式如下：

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": ""
}
```

若驗證失敗，可回傳：

```json
{
  "success": false,
  "errorCode": 1,
  "errorMessage": "Verification failed"
}
```

---

### 10. UpdateBalance 回呼（商戶端）

平台會在需要進行商戶端餘額結算時呼叫此回呼。

#### 用途

- 驗證 `playerId`、`account` 與 `accessToken`
- 驗證 `currency` 是否與商戶平台預期幣別一致
- 將玩家在遊戲中的剩餘餘額結算回商戶端
- 建議使用 `POST /integration/all-transfer-out` 進行結算

#### Request

| 參數 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 商戶 ID |
| `playerId` | string | 是 | `Launch Game` 傳入的商戶端玩家 ID |
| `account` | string | 是 | 玩家帳號 |
| `accessToken` | string | 是 | `Launch Game` 傳入的商戶端 access token |
| `currency` | string | 是 | 接入時設定的商戶幣別 |
| `timestamp` | integer | 是 | Unix 秒級時間戳 |
| `hash` | string | 是 | 請求簽章 |

#### 簽章參數順序

```text
merchantId, timestamp
```

#### Response

請回傳 HTTP `200`，JSON 格式如下：

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": ""
}
```

若結算失敗，可回傳：

```json
{
  "success": false,
  "errorCode": 1,
  "errorMessage": "Settlement failed"
}
```

---

## 資料型別

### Launch betLimits 物件

`Launch Game` 必須提供以下所有 key：

| Key | 說明 |
|-----|------|
| `bigSmall` | BIG / SMALL |
| `oddEven` | ODD / EVEN |
| `eachDouble` | Each DOUBLE |
| `eachTripple` | Each TRIPLE |
| `sum` | SUM |
| `single` | SINGLE |
| `anyTripple` | ANY TRIPLE |

每個 key 都必須包含：

| 欄位 | 型別 | 說明 |
|------|------|------|
| `minBetLimit` | number | 該玩法的最小下注限制 |
| `maxBetLimit` | number | 該玩法的最大下注限制 |

範例：

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

| 值 | 說明 |
|----|------|
| `BIG` | 數字結果為 5-9 |
| `SMALL` | 數字結果為 0-4 |
| `ODD` | 單數結果 |
| `EVEN` | 雙數結果 |
| `DOUBLE` | 任兩位數字相同 |
| `TRIPLE` | 三位數字皆相同 |
| `SUM` | 總和玩法 |
| `SINGLE` | 指定單一數字 |
| `ANY_TRIPLE` | 任意豹子 |

### Bet Result Types

| 值 | 說明 |
|----|------|
| `PENDING` | 尚未結算 |
| `WIN` | 下注獲勝 |
| `LOSE` | 下注失敗 |
| `REFUND` | 投注已退款 |
