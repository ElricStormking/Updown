# 撟喳?游? API ?辣

**?嚗?* 1.0  
**?敺?堆?** 2026 撟?2 ??3 ?? 

---

## ?桅?

1. [璁?](#璁?)
2. [撽?璈](#撽?璈)
3. [蝪賜???](#蝪賜???)
4. [?箸 URL](#?箸-url)
5. [????澆?](#????澆?)
6. [?航炊隞?Ⅳ](#?航炊隞?Ⅳ)
7. [API 蝡舫?](#api-蝡舫?)
   - [撱箇?撣唾?](#1-撱箇?撣唾?)
   - [頧狡](#2-頧狡)
   - [??銝釣蝝?(#3-??銝釣蝝??
   - [??頧狡蝝?(#4-??頧狡蝝??
   - [???](#5-???)
   - [??銝釣??](#6-??銝釣??)
   - [閮剖?銝釣??](#7-閮剖?銝釣??)
   - [??蝑寧??ａ?](#8-??蝑寧??ａ?)
   - [閮剖?蝑寧??ａ?](#9-閮剖?蝑寧??ａ?)
8. [鞈?憿?](#鞈?憿?)
9. [蝔Ⅳ蝭?](#蝔Ⅳ蝭?)

---

## 璁?

?祆?隞嗉牧?像?啣?雿憒????游? API 撠?Hi-Lo BTC ??亙撌望蝟餌絞?府 API ?迂???孵銵誑銝?雿?

- 撱箇??拙振撣唾?
- 撠摰園?脰??狡 / ?狡
- ?亥岷銝釣蝝??- ?亥岷頧狡蝝??- 隞亙歇撽??摰貶ESSION???
- ??銝西身摰?瘜券?憿?蝑寧??ａ?

???API 蝡舫??蝙??**HTTP POST** ?寞?嚗?瘙????摰孵???**JSON** ?澆???
---

## 撽?璈

瘥?API 隢??賢???隞乩??孵??脰?頨怠?撽?嚗?
1. **?振 ID**嚗merchantId`嚗?銝??唾??頂蝯勗??策?函??臭??振霅蝣?2. **?**嚗timestamp`嚗??嗅???Unix ?嚗雿蝘?10 雿嚗?3. **蝪賜?**嚗hash`嚗?撠?瘙??貉??函?撖??潭敺?蝬?SHA256 瞍?瘜???????
### ?撽?

- ?敹??其撩??嗅?????**5嚚?0 蝘?* 蝭???- 頞甇斤????撠◤??嚗蒂?喳??航炊隞?Ⅳ `1002`

---

## 蝪賜???

### ??撖?

?函???撖??箔?蝺隢?蝟餌絞??????**32 雿? BASE64** 摮葡??憒亙?靽恣甇文???蝯?敺?脫摰Ｘ蝡舐?蝣潔葉??
### 蝪賜?瞍?瘜?
```
hash = SHA256(param1 + "&" + param2 + "&" + ... + "&" + hashKey)
```

**甇仿?嚗?*
1. 靘??API ????摨?撠????訾誑 `&` 雿??蝚行??2. ?冽撠曇蕭??`&`嚗??交??`hashKey`
3. 撠?亙???銝脰?蝞?SHA256 ????4. 撠????撠神???剝脣摮葡嚗 64 ????

### 蝭?嚗avaScript / Node.js嚗?
```javascript
const crypto = require('crypto');

function generateSignature(params, hashKey) {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// AccountCreate 蝭?
const merchantId = 'MERCHANT001';
const account = 'player123';
const timestamp = Math.floor(Date.now() / 1000);
const hashKey = 'your-32-char-secret-key-here!!!';

const hash = generateSignature([merchantId, account, timestamp.toString()], hashKey);
```

### 蝭?嚗ython嚗?
```python
import hashlib
import time

def generate_signature(params, hash_key):
    data = '&'.join(params) + '&' + hash_key
    return hashlib.sha256(data.encode()).hexdigest()

# AccountCreate 蝭?
merchant_id = 'MERCHANT001'
account = 'player123'
timestamp = int(time.time())
hash_key = 'your-32-char-secret-key-here!!!'

hash_value = generate_signature([merchant_id, account, str(timestamp)], hash_key)
```

### 蝭?嚗ava嚗?
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

## ?箸 URL

| ?啣? | ?箸 URL |
|------|----------|
| 甇???啣?嚗roduction嚗?| `https://api.your-game-domain.com` |
| 皜祈岫?啣?嚗andbox嚗?| `https://sandbox-api.your-game-domain.com` |

??垢暺?頝臬??韌? `/integration/`

---

## ????澆?

???API ?????萄儐隞乩?蝯?嚗?
```json
{
  "success": true | false,
  "errorCode": 0,
  "errorMessage": "",
  "data": { ... } | null
}
```

| 甈? | 憿? | 隤芣? |
|------|------|------|
| `success` | boolean | 隢?????`true`嚗仃? `false` |
| `errorCode` | integer | ??? `0`嚗仃???喳?撠??隤支誨蝣?|
| `errorMessage` | string | ???蝛箏?銝莎?憭望???隤方牧??|
| `data` | object / null | ?????????憭望?? `null` |

---

## ?航炊隞?Ⅳ

| 隞?Ⅳ | ?迂 | 隤芣? |
|------|------|------|
| `0` | SUCCESS | 隢??? |
| `1001` | INVALID_SIGNATURE | 蝪賜?撽?憭望? |
| `1002` | TIMESTAMP_EXPIRED | ?頞??蝭?嚗?嚚?0 蝘? |
| `1003` | MERCHANT_NOT_FOUND | 蝟餌絞銝剜?曉閰脣?摰?ID |
| `1004` | MERCHANT_INACTIVE | ?振撣唾?撌脰◤? |
| `2001` | ACCOUNT_ALREADY_EXISTS | ?拙振撣唾?撌脣???|
| `2002` | ACCOUNT_NOT_FOUND | ?芣?啁摰嗅董??|
| `3001` | INSUFFICIENT_BALANCE | ?狡??頞?擗?嚗?憿?頞?|
| `3002` | DUPLICATE_ORDER_NUMBER | 頧狡 ID 撌脰◤雿輻嚗?銴??殷? |
| `3003` | INVALID_TRANSFER_TYPE | 頧狡憿??⊥?嚗?? 0 ??1嚗?|
| `4001` | INVALID_PAGE_SIZE | 瘥?蝑敹???1嚚?00 銋? |
| `4002` | INVALID_PAGE_NUMBER | ?Ⅳ敹? >= 1 |
| `5001` | INVALID_BET_AMOUNT_LIMIT | 銝釣???詨潛??|
| `5002` | INVALID_TOKEN_VALUES | 蝑寧??ａ??詨潛??|
| `9999` | INTERNAL_ERROR | 隡箏??典?券隤?|

---

## API 蝡舫?

### 1. 撱箇?撣唾?

?券??脩頂蝯曹葉撱箇?銝??摰嗅董??
**蝡舫?嚗?* `POST /integration/account/create`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `account` | string | ??| ?臭??摰嗅董???亦Ⅳ |
| `timestamp` | integer | ??| Unix ?嚗雿蝘?10 雿嚗?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

**??嚗?*
```json
{
  "success": true,
  "errorCode": 0,
  "errorMessage": "",
  "data": null
}
```

**憭望?嚗董?歇摮嚗?**
```json
{
  "success": false,
  "errorCode": 2001,
  "errorMessage": "Account already exists",
  "data": null
}
```

---

### 2. 頧狡

撠摰嗥???Ｗ??脰??狡??甈暹?雿?
**蝡舫?嚗?* `POST /integration/transfer`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `account` | string | ??| ?拙振撣唾?霅蝣?|
| `transferId` | string | ??| ?臭???甈?ID嚗?澆蝑找??? |
| `type` | integer | ??| `0` = ?狡嚗??仿??莎?嚗1` = ?狡嚗????喳?摰塚? |
| `amount` | number | ??| 頧狡??嚗???> 0嚗?|
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + account + "&" + type + "&" + amount + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?嚗?甈橘?

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

#### 隢?蝭?嚗?甈橘?

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

#### ??

**??嚗?*
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

| 甈? | 憿? | 隤芣? |
|------|------|------|
| `balance` | number | 頧狡敺摰嗥???圈?憿?|

**憭望?嚗?憿?頞喉?嚗?*
```json
{
  "success": false,
  "errorCode": 3001,
  "errorMessage": "Insufficient balance",
  "data": null
}
```

---

### 3. ??銝釣蝝??
??閰脣?摰嗆?銝??摰嗥???銝釣蝝??
**蝡舫?嚗?* `POST /integration/bets`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `startBetTime` | string | ??| 韏瑕???蝭拚璇辣嚗SO 8601 UTC ?澆?嚗?|
| `pageSize` | integer | ??| 瘥?蝑嚗?嚚?00嚗?|
| `pageNumber` | integer | ??| ?Ⅳ嚗? 1 ??嚗?|
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**蝪賜?銝剔??交??澆?嚗?* `yyyyMMddHHmmssfff`嚗TC嚗? 
- 蝭?嚗2026-02-02T10:30:00.123Z` ??`20260202103000123`

#### 隢?蝭?

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

#### ??

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

#### 銝釣蝝??雿牧??
| 甈? | 憿? | 隤芣? |
|------|------|------|
| `id` | string | ?臭???瘜刻??亦Ⅳ |
| `account` | string | ?拙振撣唾? |
| `roundId` | integer | ??? ID |
| `betType` | string | `"DIGIT"`嚗摮?瘜剁???`"HILO"`嚗?雿?瘜剁? |
| `side` | string / null | HILO ?釣? `"UP"` ??`"DOWN"` |
| `digitType` | string / null | ?詨??釣憿?嚗?? [?詨??釣憿?](#?詨??釣憿?)嚗?|
| `selection` | string / null | ?釣?賊???|
| `amount` | number | 銝釣?? |
| `odds` | number | 鞈?? |
| `result` | string | `"PENDING"`嚗脰?銝哨??"WIN"`嚗?嚗"LOSE"`嚗?嚗? `"REFUND"`嚗甈橘? |
| `payout` | number | 瘣曉蔗??嚗撓? 0嚗?|
| `betTime` | string | 銝釣??嚗SO 8601嚗?|
| `lockedPrice` | number / null | ?????? BTC ?寞 |
| `finalPrice` | number / null | ??蝯??? BTC ?寞 |
| `winningSide` | string / null | `"UP"`?"DOWN"`?? null嚗像撅嚗?|
| `digitResult` | string / null | 3 雿摮?????靘? "025"嚗?|
| `digitSum` | integer / null | 3 雿摮???0嚚?7嚗?|

---

### 4. ??頧狡蝝??
??閰脣?摰嗥???頧狡蝝??
**蝡舫?嚗?* `POST /integration/transfers`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `startTime` | string | ??| 韏瑕???蝭拚璇辣嚗SO 8601 UTC ?澆?嚗?|
| `pageSize` | integer | ??| 瘥?蝑嚗?嚚?00嚗?|
| `pageNumber` | integer | ??| ?Ⅳ嚗? 1 ??嚗?|
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + formattedStartTime + "&" + pageSize + "&" + pageNumber + "&" + timestamp + "&" + hashKey)
```

**蝪賜?銝剔??交??澆?嚗?* `yyyyMMddHHmmssfff`嚗TC嚗?
#### 隢?蝭?

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

#### ??

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
        "balanceBefore": 50.00,
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

#### 頧狡蝝??雿牧??
| 甈? | 憿? | 隤芣? |
|------|------|------|
| `id` | string | ?臭???甈曇??亦Ⅳ |
| `account` | string | ?拙振撣唾? |
| `transferId` | string | ?函?頧狡 ID |
| `type` | integer | `0` = ?狡嚗1` = ?狡 |
| `amount` | number | 頧狡?? |
| `balanceBefore` | number | Balance before transfer |
| `balanceAfter` | number | 頧狡敺?憿?|
| `createdAt` | string | 頧狡??嚗SO 8601嚗?|

---

### 5. ???

?箇摰嗥?????頨怠?撽?????URL??
**蝡舫?嚗?* `POST /integration/launch`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `account` | string | ??| ?拙振撣唾?霅蝣?|
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + account + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "account": "player123",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

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

| 甈? | 憿? | 隤芣? |
|------|------|------|
| `url` | string | ?葆 JWT 摮?隞斤?????URL |

#### 雿輻?孵?

撠?? URL ?潛??冽? iframe 銝剝????喳?箄府?拙振??????誘??閮剜???? 1 撠???
---

### 6. ??銝釣??

??閰脣?摰嗥?身摰?銝釣????
**蝡舫?嚗?* `POST /integration/config/bet-limit/get`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

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

### 7. 閮剖?銝釣??

閮剖?閰脣?摰嗆?????閮梁??雿??擃?瘜券?憿?
**蝡舫?嚗?* `POST /integration/config/bet-limit`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `minBetAmount` | number | ??| ?拙振瘥????雿?瘜券?憿?|
| `maxBetAmount` | number | ??| ?拙振瘥????擃?瘜券?憿?|
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**閬?嚗?*
- `minBetAmount` 敹?撠???潛??雿?蝑寧??ａ???
**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + minBetAmount + "&" + maxBetAmount + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "minBetAmount": 0,
  "maxBetAmount": 1000,
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

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

### 8. ??蝑寧??ａ?

???桀??釣隞銝＊蝷箇? 7 蝔桃食?憿?
**蝡舫?嚗?* `POST /integration/config/token-values/get`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + timestamp + "&" + hashKey)
```

#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

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

### 9. 閮剖?蝑寧??ａ?

?芸?蝢拇?瘜其??Ｖ?憿舐內??7 蝔桃食?憿?
**蝡舫?嚗?* `POST /integration/config/token-values`

#### 隢?

| ? | 憿? | 敹‵ | 隤芣? |
|------|------|------|------|
| `merchantId` | string | ??| ?函??振 ID |
| `tokenValues` | number[] | ??| 7 ?食?憿????嚗?摨敺椰?啣) |
| `timestamp` | integer | ??| Unix ?嚗雿蝘?|
| `hash` | string | ??| 隢?蝪賜? |

**閬?嚗?*
- ?雿?蝑寧??ａ?敹?憭扳???潛?身摰? `minBetAmount`??
**蝪賜??嚗?摨?嚗?*
```
hash = SHA256(merchantId + "&" + tokenValuesCSV + "&" + timestamp + "&" + hashKey)
```

?嗡葉 `tokenValuesCSV` ?箄?瘙葉 7 ?憿潔誑?????潭????銝脯?
#### 隢?蝭?

```json
{
  "merchantId": "MERCHANT001",
  "tokenValues": [5, 10, 20, 50, 100, 200, 500],
  "timestamp": 1706886400,
  "hash": "a1b2c3d4e5f6..."
}
```

#### ??

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

## 鞈?憿?

### ?詨??釣憿?

| 憿? | 隤芣? | ?臬?閬??|
|------|------|--------------|
| `SMALL` | ???詨?銋???0嚚?3 | ??|
| `BIG` | ???詨?銋???14嚚?7 | ??|
| `ODD` | ???詨?銋??箏???| ??|
| `EVEN` | ???詨?銋??箏??| ??|
| `ANY_TRIPLE` | 3 雿摮?函??| ??|
| `DOUBLE` | ????????靘? "00"??11"嚗?| ?荔?`"00"` 嚚?`"99"`嚗?|
| `TRIPLE` | ????????靘? "000"??111"嚗?| ?荔?`"000"` 嚚?`"999"`嚗?|
| `SUM` | ???摮蜇??| ?荔?`"3"` 嚚?`"27"`嚗?|
| `SINGLE` | ????摮撠?曆?甈?| ?荔?`"0"` 嚚?`"9"`嚗?|

### 銝釣蝯?憿?

| 蝯? | 隤芣? |
|------|------|
| `PENDING` | ?釣?脰?銝哨???撠蝯? |
| `WIN` | ?拙振?脣? |
| `LOSE` | ?拙振頛豢? |
| `REFUND` | ?釣撌脤甈橘?????嚗?|

---

## 蝔Ⅳ蝭?

### 摰?游?蝭?嚗ode.js嚗?
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

// 雿輻蝭?
async function main() {
  const integration = new GameIntegration(
    'MERCHANT001',
    'your-32-char-secret-key-here!!!',
    'https://api.your-game-domain.com'
  );

  // 撱箇?撣唾?
  const createResult = await integration.createAccount('player123');
  console.log('撱箇?撣唾?:', createResult);

  // ?狡 100 USDT
  const depositResult = await integration.transfer(
    'player123',
    'DEP-' + Date.now(),
    0,
    100
  );
  console.log('?狡:', depositResult);

  // ???
  const launchResult = await integration.launchGame('player123');
  console.log('? URL:', launchResult.data?.url);

  // ??銝釣蝝??  const betsResult = await integration.getBetHistory(
    '2026-01-01T00:00:00.000Z',
    50,
    1
  );
  console.log('銝釣蝝??', betsResult);

  // ?狡 50 USDT
  const withdrawResult = await integration.transfer(
    'player123',
    'WDR-' + Date.now(),
    1,
    50
  );
  console.log('?狡:', withdrawResult);
}

main().catch(console.error);
```


