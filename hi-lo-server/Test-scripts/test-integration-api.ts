import * as crypto from 'crypto';

const CONFIG = {
  merchantId: process.env.MERCHANT_ID ?? 'TEST_MERCHANT',
  hashKey: process.env.HASH_KEY ?? 'dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4001',
};

function generateSignature(params: string[], hashKey: string): string {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

function formatDateForSignature(date: Date): string {
  const pad = (n: number, len: number = 2) => n.toString().padStart(len, '0');
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

async function makeRequest(endpoint: string, body: Record<string, any>) {
  const url = `${CONFIG.apiBaseUrl}${endpoint}`;
  console.log('\n--- Request ---');
  console.log(`POST ${url}`);
  console.log('Body:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    console.log('\n--- Response ---');
    console.log('Status:', response.status);
    console.log('Body:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('\n--- Error ---');
    console.error(error);
  }
}

async function createAccount(account: string) {
  const timestamp = getTimestamp();
  const params = [CONFIG.merchantId, account, timestamp.toString()];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/account/create', {
    merchantId: CONFIG.merchantId,
    account,
    timestamp,
    hash,
  });
}

async function transfer(
  account: string,
  type: number,
  amount: number,
  transferId: string,
) {
  const timestamp = getTimestamp();
  const params = [
    CONFIG.merchantId,
    account,
    type.toString(),
    amount.toString(),
    timestamp.toString(),
  ];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/transfer', {
    merchantId: CONFIG.merchantId,
    account,
    transferId,
    type,
    amount,
    timestamp,
    hash,
  });
}

async function launchGame(
  account: string,
  options?: {
    playerId?: string;
    merchantAccessToken?: string;
    betLimits?: Record<string, number>;
  },
) {
  const timestamp = getTimestamp();
  const params = [CONFIG.merchantId, account, timestamp.toString()];
  const hash = generateSignature(params, CONFIG.hashKey);

  const requestBody: Record<string, unknown> = {
    merchantId: CONFIG.merchantId,
    account,
    timestamp,
    hash,
  };
  if (options?.playerId) {
    requestBody.playerId = options.playerId;
  }
  if (options?.merchantAccessToken) {
    requestBody.accessToken = options.merchantAccessToken;
  }
  if (options?.betLimits) {
    requestBody.betLimits = options.betLimits;
  }

  await makeRequest('/integration/launch', requestBody);
}

async function allTransferOut(account: string, transferId: string) {
  const timestamp = getTimestamp();
  const params = [CONFIG.merchantId, account, timestamp.toString()];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/all-transfer-out', {
    merchantId: CONFIG.merchantId,
    account,
    transferId,
    timestamp,
    hash,
  });
}

async function getBetHistory(startDate?: string) {
  const timestamp = getTimestamp();
  const start = startDate ? new Date(startDate) : new Date('2026-01-01T00:00:00Z');
  const formattedTime = formatDateForSignature(start);
  const pageSize = 10;
  const pageNumber = 1;

  const params = [
    CONFIG.merchantId,
    formattedTime,
    pageSize.toString(),
    pageNumber.toString(),
    timestamp.toString(),
  ];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/bets', {
    merchantId: CONFIG.merchantId,
    startBetTime: start.toISOString(),
    pageSize,
    pageNumber,
    timestamp,
    hash,
  });
}

async function getTransferHistory(startDate?: string) {
  const timestamp = getTimestamp();
  const start = startDate ? new Date(startDate) : new Date('2026-01-01T00:00:00Z');
  const formattedTime = formatDateForSignature(start);
  const pageSize = 10;
  const pageNumber = 1;

  const params = [
    CONFIG.merchantId,
    formattedTime,
    pageSize.toString(),
    pageNumber.toString(),
    timestamp.toString(),
  ];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/transfers', {
    merchantId: CONFIG.merchantId,
    startTime: start.toISOString(),
    pageSize,
    pageNumber,
    timestamp,
    hash,
  });
}

async function getBetLimit() {
  const timestamp = getTimestamp();
  const params = [CONFIG.merchantId, timestamp.toString()];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/config/bet-limit/get', {
    merchantId: CONFIG.merchantId,
    timestamp,
    hash,
  });
}

async function setBetLimit(minBetAmount: number, maxBetAmount: number) {
  const timestamp = getTimestamp();
  const params = [
    CONFIG.merchantId,
    minBetAmount.toString(),
    maxBetAmount.toString(),
    timestamp.toString(),
  ];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/config/bet-limit', {
    merchantId: CONFIG.merchantId,
    minBetAmount,
    maxBetAmount,
    timestamp,
    hash,
  });
}

async function getTokenValues() {
  const timestamp = getTimestamp();
  const params = [CONFIG.merchantId, timestamp.toString()];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/config/token-values/get', {
    merchantId: CONFIG.merchantId,
    timestamp,
    hash,
  });
}

async function setTokenValues(tokenValues: number[]) {
  const timestamp = getTimestamp();
  const tokenValuesSignature = tokenValues.join(',');
  const params = [
    CONFIG.merchantId,
    tokenValuesSignature,
    timestamp.toString(),
  ];
  const hash = generateSignature(params, CONFIG.hashKey);

  await makeRequest('/integration/config/token-values', {
    merchantId: CONFIG.merchantId,
    tokenValues,
    timestamp,
    hash,
  });
}

function printUsage() {
  console.log(`
Integration API Test Helper

Usage: npx ts-node Test-scripts/test-integration-api.ts <command> [args]

Commands:
  create-account <account>                    Create a new player account
  transfer-in <account> <amount> <transferId> Deposit funds to player
  transfer-out <account> <amount> <transferId> Withdraw funds from player
  launch <account>                            Get game launch URL
  launch-callback <account> <playerId> <merchantAccessToken>
                                              Get callback-mode launch URL
  all-transfer-out <account> <transferId>     Transfer out all player balance
  bet-history [startDate]                     Get bet history
  transfer-history [startDate]                Get transfer history
  get-bet-limit                               Get bet limits
  set-bet-limit <min> <max>                   Set bet limits
  get-token-values                            Get token values
  set-token-values <v1,v2,v3,v4,v5,v6,v7>      Set token values

Environment Variables:
  MERCHANT_ID   - Merchant ID (default: TEST_MERCHANT)
  HASH_KEY      - Merchant hash key (default: test key)
  API_BASE_URL  - API base URL (default: http://localhost:4000)

Examples:
  npx ts-node Test-scripts/test-integration-api.ts create-account player001
  npx ts-node Test-scripts/test-integration-api.ts transfer-in player001 100 TXN001
  npx ts-node Test-scripts/test-integration-api.ts transfer-out player001 50 TXN002
  npx ts-node Test-scripts/test-integration-api.ts launch player001
  npx ts-node Test-scripts/test-integration-api.ts launch-callback player001 pid-001 merchantToken001
  npx ts-node Test-scripts/test-integration-api.ts all-transfer-out player001 TXN003
  npx ts-node Test-scripts/test-integration-api.ts bet-history 2026-01-01
  npx ts-node Test-scripts/test-integration-api.ts transfer-history
  npx ts-node Test-scripts/test-integration-api.ts get-bet-limit
  npx ts-node Test-scripts/test-integration-api.ts set-bet-limit 0 1000
  npx ts-node Test-scripts/test-integration-api.ts get-token-values
  npx ts-node Test-scripts/test-integration-api.ts set-token-values 5,10,20,50,100,200,500
`);
}

async function main() {
  // Debug: show raw arguments
  console.log('Raw argv:', process.argv);
  
  const [, , command, ...args] = process.argv;

  console.log('Parsed command:', command);
  console.log('Parsed args:', args);
  console.log('Config:', {
    merchantId: CONFIG.merchantId,
    hashKey: CONFIG.hashKey.substring(0, 10) + '...',
    apiBaseUrl: CONFIG.apiBaseUrl,
  });

  switch (command) {
    case 'create-account':
      if (!args[0]) {
        console.error('Error: account name required');
        console.error('Usage: npx ts-node Test-scripts/test-integration-api.ts create-account <account>');
        process.exit(1);
      }
      await createAccount(args[0]);
      break;

    case 'transfer-in':
      if (!args[0] || !args[1] || !args[2]) {
        console.error('Error: account, amount, and transferId required');
        process.exit(1);
      }
      await transfer(args[0], 0, Number(args[1]), args[2]);
      break;

    case 'transfer-out':
      if (!args[0] || !args[1] || !args[2]) {
        console.error('Error: account, amount, and transferId required');
        process.exit(1);
      }
      await transfer(args[0], 1, Number(args[1]), args[2]);
      break;

    case 'launch':
      if (!args[0]) {
        console.error('Error: account name required');
        process.exit(1);
      }
      await launchGame(args[0]);
      break;

    case 'launch-callback':
      if (!args[0] || !args[1] || !args[2]) {
        console.error(
          'Error: account, playerId, and merchantAccessToken required',
        );
        process.exit(1);
      }
      await launchGame(args[0], {
        playerId: args[1],
        merchantAccessToken: args[2],
      });
      break;

    case 'all-transfer-out':
      if (!args[0] || !args[1]) {
        console.error('Error: account and transferId required');
        process.exit(1);
      }
      await allTransferOut(args[0], args[1]);
      break;

    case 'bet-history':
      await getBetHistory(args[0]);
      break;

    case 'transfer-history':
      await getTransferHistory(args[0]);
      break;

    case 'get-bet-limit':
      await getBetLimit();
      break;

    case 'set-bet-limit':
      if (!args[0] || !args[1]) {
        console.error('Error: min and max bet amounts required');
        process.exit(1);
      }
      await setBetLimit(Number(args[0]), Number(args[1]));
      break;

    case 'get-token-values':
      await getTokenValues();
      break;

    case 'set-token-values':
      if (!args[0]) {
        console.error('Error: token values required');
        process.exit(1);
      }
      await setTokenValues(args[0].split(',').map((v) => Number(v)));
      break;

    default:
      printUsage();
      break;
  }
}

main().catch(console.error);
