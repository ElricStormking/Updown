# 平台整合 API 文件

**版本:** 1.0  
**最後更新:** 2026年2月  

---

## 目錄

1. [概述](#概述)
2. [身份驗證](#身份驗證)
3. [簽名生成](#簽名生成)
4. [基礎網址](#基礎網址)
5. [通用回應格式](#通用回應格式)
6. [錯誤代碼](#錯誤代碼)
7. [API 端點](#api-端點)
   - [建立帳戶](#1-建立帳戶)
   - [轉帳](#2-轉帳)
   - [取得投注紀錄](#3-取得投注紀錄)
   - [取得轉帳紀錄](#4-取得轉帳紀錄)
   - [啟動遊戲](#5-啟動遊戲)
   - [更新投注金額上限](#6-更新投注金額上限)
   - [更新代幣面額](#7-更新代幣面額)
8. [資料類型](#資料類型)
9. [程式碼範例](#程式碼範例)

---

## 概述

本文件描述平台合作夥伴將 COMBI 3 BTC 遊戲整合到其系統中的整合 API。此 API 允許合作夥伴：

- 建立玩家帳戶
- 轉入/轉出玩家錢包資金
- 查詢投注紀錄
- 查詢轉帳紀錄
- 使用已驗證的玩家會話啟動遊戲
- 設定投注金額上限與代幣面額

所有 API 端點使用 **HTTP POST** 方法，並接受/回傳 **JSON** 格式資料。

---

## 身份驗證

每個 API 請求都需要通過以下方式進行身份驗證：

1. **商戶 ID** (`merchantId`)：在入駐時提供的唯一商戶識別碼
2. **時間戳** (`timestamp`)：當前 Unix 時間戳，以秒為單位（10位數字）
3. **簽名** (`hash`)：使用您的密鑰將請求參數組合後計算的 SHA256 雜湊值

### 時間戳驗證

- 時間戳必須在伺服器當前時間的 **10秒** 範圍內
- 超出此範圍的時間戳將被拒絕，並回傳錯誤代碼 `1002`

---

## 簽名生成

### 雜湊密鑰

您的雜湊密鑰是在商戶入駐時提供的 **32字元 BASE64** 字串。請妥善保管此密鑰，切勿在客戶端程式碼中暴露。

### 簽名演算法

```
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

**步驟：**
1. 按照每個 API 指定的順序，將所有參數用 `&` 分隔符串接
2. 在末尾附加 `&` 後接上您的 `hashKey`
3. 計算結果字串的 SHA256 雜湊值
4. 轉換為小寫十六進位字串（64字元）

### 範例（JavaScript/Node.js）

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

## 基礎網址

| 環境 | 基礎網址 |
|------|----------|
| 正式環境 | `https://api.your-game-domain.com` |
| 測試環境 | `https://sandbox-api.your-game-domain.com` |

所有端點都以 `/integration/` 為前綴

---

## 通用回應格式

所有 API 回應遵循以下結構：

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
| `success` | boolean | 請求成功為 `true`，否則為 `false` |
| `errorCode` | integer | 成功時為 `0`，失敗時為錯誤代碼 |
| `errorMessage` | string | 成功時為空，失敗時為錯誤說明 |
| `data` | object/null | 成功時為回應資料，失敗時為 `null` |

---

## 錯誤代碼

| 代碼 | 名稱 | 說明 |
|------|------|------|
| `0` | SUCCESS | 請求成功完成 |
| `1001` | INVALID_SIGNATURE | 簽名驗證失敗 |
| `1002` | TIMESTAMP_EXPIRED | 時間戳超出有效範圍（±10秒） |
| `1003` | MERCHANT_NOT_FOUND | 系統中找不到該商戶 ID |
| `1004` | MERCHANT_INACTIVE | 商戶帳戶已停用 |
| `2001` | ACCOUNT_ALREADY_EXISTS | 玩家帳戶已存在 |
| `2002` | ACCOUNT_NOT_FOUND | 找不到玩家帳戶 |
| `3001` | INSUFFICIENT_BALANCE | 餘額不足無法提款 |
| `3002` | DUPLICATE_ORDER_NUMBER | 轉帳訂單號碼已使用 |
| `3003` | INVALID_TRANSFER_TYPE | 無效的轉帳類型（必須為 0 或 1） |
| `4001` | INVALID_PAGE_SIZE | 每頁筆數必須在 1 到 100 之間 |
| `4002` | INVALID_PAGE_NUMBER | 頁碼必須 >= 1 |
| `5001` | INVALID_BET_AMOUNT_LIMIT | 無效的投注金額上限 |
| `5002` | INVALID_TOKEN_VALUES | 無效的代幣面額 |
| `9999` | INTERNAL_ERROR | 內部伺服器錯誤 |

---

## API 端點

### 1. 建立帳戶

在遊戲系統中建立新的玩家帳戶。

**端點:** `POST /integration/account/create`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `account` | string | 是 | 唯一的玩家帳戶識別碼 |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位（10位數字） |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
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

**失敗（帳戶已存在）：**
```json
{
  "success": false,
  "errorCode": 2001,
  "errorMessage": "Account already exists",
  "data": null
}
```

---

### 2. 轉帳

將資金轉入或轉出玩家的遊戲錢包。

**端點:** `POST /integration/transfer`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `account` | string | 是 | 玩家帳戶識別碼 |
| `orderNo` | string | 是 | 唯一的轉帳訂單號碼（用於冪等性） |
| `type` | integer | 是 | `0` = 存款（轉入遊戲），`1` = 提款（轉回商戶） |
| `amount` | number | 是 | 轉帳金額（必須 > 0） |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
```
hash = SHA256(merchantId + "&" + account + "&" + type + "&" + amount + "&" + timestamp + "&" + hashKey)
```

#### 請求範例（存款）

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

#### 請求範例（提款）

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
| `balance` | number | 轉帳後玩家的新餘額 |

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

### 3. 取得投注紀錄

取得您商戶玩家的分頁投注紀錄。

**端點:** `POST /integration/bets`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `startBetTime` | string | 是 | 開始時間篩選（ISO 8601 UTC 格式） |
| `pageSize` | integer | 是 | 每頁筆數（1-100） |
| `pageNumber` | integer | 是 | 頁碼（從 1 開始） |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**簽名用日期格式：** `yyyyMMddHHmmssfff`（UTC）
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

#### 投注紀錄項目欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 唯一投注識別碼 |
| `account` | string | 玩家帳戶 |
| `roundId` | integer | 遊戲回合 ID |
| `betType` | string | `"DIGIT"` 或 `"HILO"` | 備註:目前遊戲依客戶需求已改成HILO無效只有DIGIT
| `side` | string/null | HILO 投注的 `"UP"` 或 `"DOWN"` | 備註:目前遊戲依客戶需求已改成HILO無效
| `digitType` | string/null | 數字投注類型（參見[數字投注類型](#數字投注類型)） |
| `selection` | string/null | 投注選擇值 |
| `amount` | number | 投注金額 |
| `odds` | number | 賠率倍數 |
| `result` | string | `"PENDING"`、`"WIN"`、`"LOSE"` 或 `"REFUND"` |
| `payout` | number | 派彩金額（輸了為 0） |
| `betTime` | string | 投注時間（ISO 8601） |
| `lockedPrice` | number/null | 回合鎖定時的 BTC 價格 |
| `finalPrice` | number/null | 回合結束時的 BTC 價格 |
| `winningSide` | string/null | `"UP"`、`"DOWN"` 或 null（平局） |
| `digitResult` | string/null | 3位數結果（例如 "025"） |
| `digitSum` | integer/null | 3位數總和（0-27） |

---

### 4. 取得轉帳紀錄

取得您商戶的分頁轉帳紀錄。

**端點:** `POST /integration/transfers`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `startTime` | string | 是 | 開始時間篩選（ISO 8601 UTC 格式） |
| `pageSize` | integer | 是 | 每頁筆數（1-100） |
| `pageNumber` | integer | 是 | 頁碼（從 1 開始） |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**簽名用日期格式：** `yyyyMMddHHmmssfff`（UTC）

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

#### 轉帳紀錄項目欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 唯一轉帳識別碼 |
| `account` | string | 玩家帳戶 |
| `orderNo` | string | 您的轉帳訂單號碼 |
| `type` | integer | `0` = 存款，`1` = 提款 |
| `amount` | number | 轉帳金額 |
| `balanceAfter` | number | 轉帳後餘額 |
| `createdAt` | string | 轉帳時間（ISO 8601） |

---

### 5. 啟動遊戲

為玩家生成一個已驗證的遊戲網址。

**端點:** `POST /integration/launch`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `account` | string | 是 | 玩家帳戶識別碼 |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
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
| `url` | string | 帶有 JWT 存取權杖的遊戲網址 |

#### 使用方式

在瀏覽器或 iframe 中開啟回傳的網址，即可為玩家啟動遊戲。存取權杖預設有效期為 1 小時。

---

### 6. 更新投注金額上限

更新此商戶單回合允許的最大投注金額。
預設 `maxBetAmount` 為 **5000**（若未覆寫）。

**端點:** `POST /integration/config/bet-limit`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `maxBetAmount` | number | 是 | 單回合最高投注金額 |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
```
hash = SHA256(merchantId + "&" + maxBetAmount + "&" + timestamp + "&" + hashKey)
```

#### 請求範例

```json
{
  "merchantId": "MERCHANT001",
  "maxBetAmount": 500,
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
    "minBetAmount": 1,
    "maxBetAmount": 500
  }
}
```

---

### 7. 更新代幣面額

自訂投注 UI 中顯示的 7 個代幣面額。

**端點:** `POST /integration/config/token-values`

#### 請求

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `merchantId` | string | 是 | 您的商戶 ID |
| `tokenValues` | number[] | 是 | 7 個代幣面額陣列（順序為由左至右的代幣位置） |
| `timestamp` | integer | 是 | Unix 時間戳，以秒為單位 |
| `hash` | string | 是 | 請求簽名 |

**簽名參數（按順序）：**
```
hash = SHA256(merchantId + "&" + tokenValuesCSV + "&" + timestamp + "&" + hashKey)
```

其中 `tokenValuesCSV` 為依照請求順序將 7 個值以逗號串接的字串。

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

| 類型 | 說明 | 需要選擇值 |
|------|------|-----------|
| `SMALL` | 數字總和為 0-13 | 否 |
| `BIG` | 數字總和為 14-27 | 否 |
| `ODD` | 數字總和為奇數 | 否 |
| `EVEN` | 數字總和為偶數 | 否 |
| `ANY_TRIPLE` | 3個數字全部相同 | 否 |
| `DOUBLE` | 特定對子（例如 "00"、"11"） | 是（`"00"` - `"99"`） |
| `TRIPLE` | 特定豹子（例如 "000"、"111"） | 是（`"000"` - `"999"`） |
| `SUM` | 特定總和值 | 是（`"3"` - `"27"`） |
| `SINGLE` | 單一數字至少出現一次 | 是（`"0"` - `"9"`） |

### 投注結果類型

| 結果 | 說明 |
|------|------|
| `PENDING` | 投注進行中，回合尚未結束 |
| `WIN` | 玩家獲勝 |
| `LOSE` | 玩家輸了 |
| `REFUND` | 投注已退款（回合取消） |

---

## 程式碼範例

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

// 使用範例
async function main() {
  const integration = new GameIntegration(
    'MERCHANT001',
    'your-32-char-secret-key-here!!!',
    'https://api.your-game-domain.com'
  );

  // 建立帳戶
  const createResult = await integration.createAccount('player123');
  console.log('建立帳戶:', createResult);

  // 存款 100 USDT
  const depositResult = await integration.transfer(
    'player123',
    'DEP-' + Date.now(),
    0,
    100
  );
  console.log('存款:', depositResult);

  // 啟動遊戲
  const launchResult = await integration.launchGame('player123');
  console.log('遊戲網址:', launchResult.data?.url);

  // 取得投注紀錄
  const betsResult = await integration.getBetHistory(
    '2026-01-01T00:00:00.000Z',
    50,
    1
  );
  console.log('投注紀錄:', betsResult);

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

---

## 技術支援

如有整合相關的技術支援或問題：

- **電子郵件：** integration-support@your-domain.com
- **文件網址：** https://docs.your-domain.com

---

**注意：** 請將佔位符網址和憑證替換為入駐時提供的實際值。
