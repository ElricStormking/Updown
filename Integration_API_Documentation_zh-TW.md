# 平台整合 API 文件

**版本：** 1.0  
**最後更新：** 2026 年 2 月 3 日  

---

## 目錄

1. [概要](#概要)
2. [驗證機制](#驗證機制)
3. [簽章生成](#簽章生成)
4. [基本 URL](#基本-url)
5. [通用回應格式](#通用回應格式)
6. [錯誤代碼](#錯誤代碼)
7. [API 端點](#api-端點)
   - [建立帳號](#1-建立帳號)
   - [轉款](#2-轉款)
   - [取得下注紀錄](#3-取得下注紀錄)
   - [取得轉款紀錄](#4-取得轉款紀錄)
   - [啟動遊戲](#5-啟動遊戲)
   - [取得下注限額](#6-取得下注限額)
   - [設定下注限額](#7-設定下注限額)
   - [取得筹码面額](#8-取得筹码面額)
   - [設定筹码面額](#9-設定筹码面額)
8. [資料類型](#資料類型)
9. [程碼範例](#程碼範例)

---

## 概要

本文件說明平台合作方如何透過整合 API 將 Hi-Lo BTC 遊戲接入己方系統。該 API 允許合作方執行以下操作：

- 建立玩家帳號
- 對玩家錢包進行充款 / 提款
- 查詢下注紀錄
- 查詢轉款紀錄
- 以已驗證的玩家SESSION啟動遊戲
- 取得並設定下注限額與筹码面額

所有 API 端點均使用 **HTTP POST** 方法，請求與回應的內容均為 **JSON** 格式。

---

## 驗證機制

每個 API 請求都必須通過以下方式進行身分驗證：

1. **商家 ID**（`merchantId`）：上線申請時系統分配給您的唯一商家識別碼
2. **時戳**（`timestamp`）：當前的 Unix 時戳，單位為秒（10 位數）
3. **簽章**（`hash`）：將請求參數與您的密鑑拼接後，經 SHA256 演算法生成的哈希值

### 時戳驗證

- 時戳必須在伺務器當前時間的 **5～10 秒** 範圍內
- 超出此範圍的時戳將被拒絕，並傳回錯誤代碼 `1002`

---

## 簽章生成

### 哈希密鑑

您的哈希密鑑為上線申請時系統提供的一個 **32 位元 BASE64** 字串。請妥善保管此密鑑，絕不得暴露於客戶端程碼中。

### 簽章演算法

```
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

**步驟：**
1. 依照各 API 指定的順序，將所有參數以 `&` 作為分隔符拼接
2. 在末尾追加 `&`，接著拼接您的 `hashKey`
3. 對拼接後的字串計算 SHA256 哈希值
4. 將結果轉換為小寫的十六進制字串（共 64 個字元）

### 範例（JavaScript / Node.js）

```javascript
const crypto = require('crypto');

function generateSignature(params, hashKey) {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// AccountCreate 範例
const merchantId = 'MERCHANT001';
const account = 'player123';
const timestamp = Math.floor(Date.now() / 1000);
const hashKey = 'your-32-char-secret-key-here!!!';

const hash = generateSignature([merchantId, account, timestamp.toString()], hashKey);
```

### 範例（Python）

```python
import hashlib
import time

def generate_signature(params, hash_key):
    data = '&'.join(params) + '&' + hash_key
    return hashlib.sha256(data.encode()).hexdigest()

# AccountCreate 範例
merchant_id = 'MERCHANT001'
account = 'player123'
timestamp = int(time.time())
hash_key = 'your-32-char-secret-key-here!!!'

hash_value = generate_signature([merchant_id, account, str(timestamp)], hash_key)
```

### 範例（Java）

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

## 基本 URL

| 環境 | 基本 URL |
|------|----------|
| 正式環境（Production） | `https://api.your-game-domain.com` |
| 測試環境（Sandbox） | `https://sandbox-api.your-game-domain.com` |

所有端點的路徑前綴均為 `/integration/`

---

## 通用回應格式

所有 API 的回應均遵循以下結構：

```json
{
  "success": true | false,
  "errorCode": 0,
  "errorMessage": "",
  "data": { ... } | null
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `success` | boolean | 請求成功為 `true`，失敗為 `false` |
| `errorCode` | integer | 成功時為 `0`，失敗時傳回對應的錯誤代碼 |
| `errorMessage` | string | 成功時為空字串，失敗時傳回錯誤說明 |
| `data` | object / null | 成功時傳回回應資料，失敗時為 `null` |

---

## 錯誤代碼

| 代碼 | 名稱 | 說明 |
|------|------|------|
| `0` | SUCCESS | 請求成功 |
| `1001` | INVALID_SIGNATURE | 簽章驗證失敗 |
| `1002` | TIMESTAMP_EXPIRED | 時戳超出有效範圍（5～10 秒） |
| `1003` | MERCHANT_NOT_FOUND | 系統中未找到該商家 ID |
| `1004` | MERCHANT_INACTIVE | 商家帳號已被停用 |
| `2001` | ACCOUNT_ALREADY_EXISTS | 玩家帳號已存在 |
| `2002` | ACCOUNT_NOT_FOUND | 未找到玩家帳號 |
| `3001` | INSUFFICIENT_BALANCE | 提款金額超過餘額，餘額不足 |
| `3002` | DUPLICATE_ORDER_NUMBER | 轉款 ID 已被使用（重複訂單） |
| `3003` | INVALID_TRANSFER_TYPE | 轉款類型無效（必須為 0 或 1） |
| `4001` | INVALID_PAGE_SIZE | 每頁筆數必須在 1～100 之間 |
| `4002` | INVALID_PAGE_NUMBER | 頁碼必須 >= 1 |
| `5001` | INVALID_BET_AMOUNT_LIMIT | 下注限額數值無效 |
| `5002` | INVALID_TOKEN_VALUES | 筹码面額數值無效 |
| `9999` | INTERNAL_ERROR | 伺務器內部錯誤 |

---

## API 端點

### 1. 建立帳號

在遊戲系統中建立一個新的玩家帳號。

**端點：** `POST /integration/account/create`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `account` | string | 是 | 唯一的玩家帳號識別碼 |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒（10 位數） |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

**成功：**
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": null
}
```

**失敗（帳號已存在）：**
```json
{
  "success": false,
  "errorCode": 2001,
  "errorMessage": "Account already exists",
  "data": null
}
```

---

### 2. 轉款

對玩家的遊戲錢包進行充款或提款操作。

**端點：** `POST /integration/transfer`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `account` | string | 是 | 玩家帳號識別碼 |
| `transferId` | string | 是 | 唯一的轉款 ID（用於冪等性保障） |
| `type` | integer | 是 | `0` = 充款（充入遊戲），`1` = 提款（從遊戲提出至商家） |
| `amount` | number | 是 | 轉款金額（必須 > 0） |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + account + "&" + type + "&" + amount + "&" + timestamp + "&" + hashKey)
```

#### 請求範例（充款）

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "transferId": "TXN20260202001",
  "type": 0,
  "amount": 100.00,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 請求範例（提款）

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "transferId": "TXN20260202002",
  "type": 1,
  "amount": 50.00,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

**成功：**
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

| 欄位 | 類型 | 說明 |
|------|------|------|
| `balance` | number | 轉款後玩家的最新餘額 |

**失敗（餘額不足）：**
```json
{
  "success": false,
  "errorCode": 3001,
  "errorMessage": "Insufficient balance",
  "data": null
}
```

---

### 3. 取得下注紀錄

取得該商家旗下所有玩家的分頁下注紀錄。

**端點：** `POST /integration/bets`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `startBetTime` | string | 是 | 起始時間篩選條件（ISO 8601 UTC 格式） |
| `pageSize` | integer | 是 | 每頁筆數（1～100） |
| `pageNumber` | integer | 是 | 頁碼（從 1 開始） |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**簽章中的日期格式：** `yyyyMMddHHmmssfff`（UTC）  
- 範例：`2026-02-02T10:30:00.123Z` → `20260202103000123`

#### 請求範例

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

#### 回應

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

#### 下注紀錄欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 唯一的下注識別碼 |
| `account` | string | 玩家帳號 |
| `roundId` | integer | 遊戲回合 ID |
| `betType` | string | `"DIGIT"`（數字投注）或 `"HILO"`（高低投注） |
| `side` | string / null | HILO 投注時為 `"UP"` 或 `"DOWN"` |
| `digitType` | string / null | 數字投注類型（請參閱 [數字投注類型](#數字投注類型)） |
| `selection` | string / null | 投注選項值 |
| `amount` | number | 下注金額 |
| `odds` | number | 賠率倍數 |
| `result` | string | `"PENDING"`（進行中）、`"WIN"`（勝）、`"LOSE"`（負）、或 `"REFUND"`（退款） |
| `payout` | number | 派彩金額（輸則為 0） |
| `betTime` | string | 下注時間（ISO 8601） |
| `lockedPrice` | number / null | 回合鎖定時的 BTC 價格 |
| `finalPrice` | number / null | 回合結束時的 BTC 價格 |
| `winningSide` | string / null | `"UP"`、`"DOWN"`、或 null（平局） |
| `digitResult` | string / null | 3 位數字開獎結果（例如 "025"） |
| `digitSum` | integer / null | 3 位數字之和（0～27） |

---

### 4. 取得轉款紀錄

取得該商家的分頁轉款紀錄。

**端點：** `POST /integration/transfers`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `startTime` | string | 是 | 起始時間篩選條件（ISO 8601 UTC 格式） |
| `pageSize` | integer | 是 | 每頁筆數（1～100） |
| `pageNumber` | integer | 是 | 頁碼（從 1 開始） |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**簽章中的日期格式：** `yyyyMMddHHmmssfff`（UTC）

#### 請求範例

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

#### 回應

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

#### 轉款紀錄欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 唯一的轉款識別碼 |
| `account` | string | 玩家帳號 |
| `transferId` | string | 您的轉款 ID |
| `type` | integer | `0` = 充款，`1` = 提款 |
| `amount` | number | 轉款金額 |
| `balanceAfter` | number | 轉款後餘額 |
| `createdAt` | string | 轉款時間（ISO 8601） |

---

### 5. 啟動遊戲

為玩家生成一個經身分驗證的遊戲 URL。

**端點：** `POST /integration/launch`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `account` | string | 是 | 玩家帳號識別碼 |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

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

| 欄位 | 類型 | 說明 |
|------|------|------|
| `url` | string | 附帶 JWT 存取令牌的遊戲 URL |

#### 使用方式

將傳回的 URL 於瀏览器或 iframe 中開啟，即可為該玩家啟動遊戲。存取令牌預設有效時限為 1 小時。

---

### 6. 取得下注限額

取得該商家目前設定的下注限額。

**端點：** `POST /integration/config/bet-limit/get`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "minBetAmount": 0,
    "maxBetAmount": 1000
  }
}
```

---

### 7. 設定下注限額

設定該商家每個回合允許的最低與最高下注金額。

**端點：** `POST /integration/config/bet-limit`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `minBetAmount` | number | 是 | 玩家每回合的最低下注金額 |
| `maxBetAmount` | number | 是 | 玩家每回合的最高下注金額 |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**規則：**
- `minBetAmount` 必須小於或等於目前最低的筹码面額。

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + minBetAmount + "&" + maxBetAmount + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "minBetAmount": 0,
  "maxBetAmount": 1000,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": {
    "minBetAmount": 0,
    "maxBetAmount": 1000
  }
}
```

---

### 8. 取得筹码面額

取得目前投注介面上顯示的 7 種筹码面額。

**端點：** `POST /integration/config/token-values/get`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

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

### 9. 設定筹码面額

自定義投注介面上顯示的 7 種筹码面額。

**端點：** `POST /integration/config/token-values`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商家 ID |
| `tokenValues` | number[] | 是 | 7 個筹码面額的陣列（順序為從左到右) |
| `timestamp` | integer | 是 | Unix 時戳，單位為秒 |
| `hash` | string | 是 | 請求簽章 |

**規則：**
- 最低的筹码面額必須大於或等於目前設定的 `minBetAmount`。

**簽章參數（依序）：**
```
hash = SHA256(merchantId + "&" + tokenValuesCSV + "&" + timestamp + "&" + hashKey)
```

其中 `tokenValuesCSV` 為請求中 7 個面額值以逗號分隔拼接而成的字串。

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "tokenValues": [5, 10, 20, 50, 100, 200, 500],
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### 回應

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

## 資料類型

### 數字投注類型

| 類型 | 說明 | 是否需要選項值 |
|------|------|--------------|
| `SMALL` | 各位數字之和為 0～13 | 否 |
| `BIG` | 各位數字之和為 14～27 | 否 |
| `ODD` | 各位數字之和為奇數 | 否 |
| `EVEN` | 各位數字之和為偶數 | 否 |
| `ANY_TRIPLE` | 3 位數字全部相同 | 否 |
| `DOUBLE` | 指定的雙重組合（例如 "00"、"11"） | 是（`"00"` ～ `"99"`） |
| `TRIPLE` | 指定的三重組合（例如 "000"、"111"） | 是（`"000"` ～ `"999"`） |
| `SUM` | 指定的數字總和 | 是（`"3"` ～ `"27"`） |
| `SINGLE` | 指定的單個數字至少出現一次 | 是（`"0"` ～ `"9"`） |

### 下注結果類型

| 結果 | 說明 |
|------|------|
| `PENDING` | 投注進行中，回合尚未結束 |
| `WIN` | 玩家獲勝 |
| `LOSE` | 玩家輸掉 |
| `REFUND` | 投注已退款（回合取消） |

---

## 程碼範例

### 完整整合範例（Node.js）

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

  async transfer(account, transferId, type, amount) {
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
      transferId,
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

// 使用範例
async function main() {
  const integration = new GameIntegration(
    'MERCHANT001',
    'your-32-char-secret-key-here!!!',
    'https://api.your-game-domain.com'
  );

  // 建立帳號
  const createResult = await integration.createAccount('player123');
  console.log('建立帳號:', createResult);

  // 充款 100 USDT
  const depositResult = await integration.transfer(
    'player123',
    'DEP-' + Date.now(),
    0,
    100
  );
  console.log('充款:', depositResult);

  // 啟動遊戲
  const launchResult = await integration.launchGame('player123');
  console.log('遊戲 URL:', launchResult.data?.url);

  // 取得下注紀錄
  const betsResult = await integration.getBetHistory(
    '2026-01-01T00:00:00.000Z',
    50,
    1
  );
  console.log('下注紀錄:', betsResult);

  // 提款 50 USDT
  const withdrawResult = await integration.transfer(
    'player123',
    'WDR-' + Date.now(),
    1,
    50
  );
  console.log('提款:', withdrawResult);
}

main().catch(console.error);
```
