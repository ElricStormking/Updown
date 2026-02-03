
Platform Integration Service (Public Specification)
Database
Merchant Table (Merchant)

Merchant ID (merchantId): This value must be sent when calling integration APIs
Signature Secret Key (hashKey): Required for signature and verification when calling merchant integration APIs

The signature secret key is a 32-character BASE64 string
Each API request described below requires a signature field
Signature field generation method: Combine request content into a string A, then concatenate A with the signature secret key, and compute the SHA256 hash value



Other Tables
The following tables need to add a merchantId field:

User
Bet
Integration APIs
Authentication Mechanism

Request Timestamp (timestamp) Check: The incoming timestamp must be within 5-10 seconds before the received time
Signature Check: The signature generated from the received merchant request content must match the signature (hash) field in the request


AccountCreate: Create Player in User Table
Request:

Merchant ID: merchantId
Merchant Player Account: account
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&account&timestamp&hashKey)

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: null


Transfer: Merchant Player Transfer
Request:

Merchant ID: merchantId
Merchant Player Account: account
Transfer Order Number
Type: type = 0 transfer into game; 1 transfer out (back) to merchant
Amount: amount
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&account&type&amount&timestamp&hashKey)

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns game-side balance, otherwise null

json{
    "balance": 0
}

GetBetHistory: Merchant Retrieves Historical Bet Records
Request:

Merchant ID: merchantId
Bet Start Time: startBetTime (UTC)
Page Size: pageSize 1-100
Page Number: pageNumber
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&startBetTime(format:yyyyMMddHHmmssfff)&pageSize&pageNumber&timestamp&hashKey)

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns game-side balance, otherwise null

json{
    "bets": [
        {/* single bet content */}, // Sorted by betTime, newest on first page, first record
        ...
    ],
    "pageNumber": "data page number",
    "pageSize": "records per page",
    "totalCount": "total record count",
    "totalPageNumber": "total page count"
}

GetTransferHistory: Transfer Records
Request:

Merchant ID: merchantId
Start Transfer Time: startTime (UTC)
Page Size: pageSize 1-100
Page Number: pageNumber
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&startTime(format:yyyyMMddHHmmssfff)&pageSize&pageNumber&timestamp&hashKey)

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns game-side balance, otherwise null

json{
    "transfers": [
        {/* transfer record content */},
        ...
    ],
    "pageNumber": "data page number",
    "pageSize": "records per page",
    "totalCount": "total record count",
    "totalPageNumber": "total page count"
}

LaunchGame: Login and Get Game Link (with accessToken)
Request:

Merchant ID: merchantId
Player Account: account
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&account&timestamp&hashKey)

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns game-side balance, otherwise null

json{
    "url": "https://www.ehooray.com?accessToken={jwtToken}"
}

UpdateBetLimit: Configure Max Bet Amount per Round
Request:

Merchant ID: merchantId
Max Bet Amount: maxBetAmount
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&maxBetAmount&timestamp&hashKey)
Default maxBetAmount is 5000 unless overridden.

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns updated bet limits, otherwise null

json{
    "minBetAmount": 1,
    "maxBetAmount": 500
}

UpdateTokenValues: Configure 7 Token Values
Request:

Merchant ID: merchantId
Token Values: tokenValues (array of 7 numbers, order is left-to-right slots)
Timestamp: timestamp (seconds; 10 digits)
Signature: hash = SHA256_HASH(merchantId&tokenValuesCSV&timestamp&hashKey)
tokenValuesCSV: comma-joined string of the 7 values in the request order

Response:

success: true or false
errorCode (int): Error code - 0 when success=true, other codes when success=false
errorMessage (string): Error description when failed
data: When success=true, returns updated token values, otherwise null

json{
    "tokenValues": [5, 10, 20, 50, 100, 200, 500]
}