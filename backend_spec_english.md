# Backend Specification

The field contents listed for the following functions are examples; please adjust according to actual needs.

## Backend Account Management

### 1. Account Data

#### Create
* Account
* Password (store hash value only)
* Status: Enabled/Locked/Disabled => Only enabled status can log in; locked after several failed login attempts unless unlocked

#### Query
Same as Create

#### Update
* Password (store hash value only)
* Status: Enabled/Locked/Disabled

#### Delete
None

### 2. Account Login Records

#### Create
None, only written when account logs into backend

#### Query
* Account
* Login Result: Success/Failure
* Login Failure Reason: Empty if successful
* Login Time

#### Update
None

#### Delete
None

## Game Management

### 1. Game Round Data

#### Create
None, only created when round starts

#### Query
* Round ID
* Start Time
* Lock Time
* End Time
* Locked Transaction Price
* Final (Draw) Transaction Price
* Rise/Fall
* Round Status
* Created Time
* Last Updated Time

#### Update
None, modified during round progression

#### Delete
None

### 2. Bet Data

#### Create
None, only created when bet is placed

#### Query
* Bet ID
* Merchant ID
* Player ID
* Round ID
* [Bet type related fields: side, betType, digitType, selection, odds]
* Bet Amount
* Status: Bet Success/Loss/Win
* Payout Amount
* Created Time (Bet Time)
* Last Updated Time

#### Update
None, modified during round progression

#### Delete
None

### 3. Bitcoin Transaction Amount Data

#### Create
None, only written when retrieved by server

#### Query
* ID
* Data Retrieval Time (timestamp)
* Data Source
* Created Time

#### Update
None

#### Delete
None

## Merchant Management

### 1. Merchant Basic Data

#### Create
* Merchant ID
* Merchant Name
* Currency
* Maximum Bet Amount per Bet
* Minimum Bet Amount per Bet
* Signature Secret Key

#### Query
Same as Create

#### Update
Same as Create

#### Delete
None

### 2. Merchant Game Odds Settings

#### Create
None

#### Query
* Merchant ID
* Game Type
* Bet Position
* Odds

#### Update
* Odds

#### Delete
None

## Player Management

### 1. Player Basic Data

#### Create
None, only created through merchant integration API - AccountCreate

#### Query
* Merchant ID
* Account
* Status: Enabled/Disabled

#### Update
* Status: Enabled/Disabled

#### Delete
None

### 2. Player Login (Game Launch) Records

#### Create
None, only created through merchant integration API - LaunchGame

#### Query
* Merchant ID
* Account
* Login Time

#### Update
None

#### Delete
None

## Financial Management

### 1. Transfer Records

#### Create
None, only created through merchant integration API - Transfer

#### Query
* Merchant ID
* Account
* Merchant Transfer Order Number
* Game Transfer Order Number
* Transfer Type: In/Out
* Transfer Time

#### Update
None

#### Delete
None

### 2. Wallet Transaction Records

#### Create
None, only created when player wallet balance changes

#### Query
* Merchant ID
* Account
* Transaction Type: Transfer In/Transfer Out/Bet/Cancel/Payout/Bonus
* Transaction Number: (Merchant Transfer Order Number/Game Transfer Order Number/Bet Number/Bonus Number)
* Balance Before
* Transaction Amount: Positive for increase, negative for decrease
* Balance After
* Transaction Time

#### Update
None

#### Delete
None