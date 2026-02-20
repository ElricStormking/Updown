import { createServer } from 'http';
import * as crypto from 'crypto';

const PORT = Number(process.env.PORT ?? 4100);
const EXPECTED_MERCHANT_ID = process.env.MERCHANT_ID ?? 'TEST_MERCHANT';
const HASH_KEY =
  process.env.HASH_KEY ?? 'dGVzdGhhc2hrZXkxMjM0NTY3ODkwYWI=';
const FAIL_LOGIN = process.env.FAIL_LOGIN === 'true';
const FAIL_UPDATE = process.env.FAIL_UPDATE === 'true';

function generateSignature(params: string[], hashKey: string): string {
  const data = params.join('&') + '&' + hashKey;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function sendJson(res: any, body: Record<string, unknown>) {
  console.log(
    `[${new Date().toISOString()}] response: ${JSON.stringify(body, null, 2)}`,
  );
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function validateCommonBody(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Invalid JSON body';
  if (body.merchantId !== EXPECTED_MERCHANT_ID) return 'Unexpected merchantId';
  if (!Number.isFinite(body.timestamp)) return 'Invalid timestamp';
  if (typeof body.hash !== 'string') return 'Missing hash';
  const expectedHash = generateSignature(
    [body.merchantId, String(body.timestamp)],
    HASH_KEY,
  );
  if (expectedHash.toLowerCase() !== body.hash.toLowerCase()) {
    return 'Invalid signature';
  }
  if (typeof body.playerId !== 'string' || !body.playerId.trim()) {
    return 'Missing playerId';
  }
  if (typeof body.account !== 'string' || !body.account.trim()) {
    return 'Missing account';
  }
  if (typeof body.accessToken !== 'string' || !body.accessToken.trim()) {
    return 'Missing accessToken';
  }
  if (typeof body.currency !== 'string' || !body.currency.trim()) {
    return 'Missing currency';
  }
  return null;
}

const server = createServer((req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, {
      success: false,
      errorCode: 9001,
      errorMessage: 'Method not allowed',
    });
  }

  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });

  req.on('end', () => {
    let body: any = null;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, {
        success: false,
        errorCode: 9002,
        errorMessage: 'Invalid JSON',
      });
    }

    const maskedBody = {
      ...body,
      accessToken:
        typeof body?.accessToken === 'string'
          ? `${body.accessToken.slice(0, 4)}***`
          : body?.accessToken,
    };
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} request: ${JSON.stringify(maskedBody, null, 2)}`,
    );

    const commonError = validateCommonBody(body);
    if (commonError) {
      return sendJson(res, {
        success: false,
        errorCode: 9003,
        errorMessage: commonError,
      });
    }

    if (req.url === '/login-player') {
      return sendJson(res, {
        success: !FAIL_LOGIN,
        errorCode: FAIL_LOGIN ? 9101 : 0,
        errorMessage: FAIL_LOGIN ? 'Forced login callback failure' : '',
      });
    }

    if (req.url === '/update-balance') {
      return sendJson(res, {
        success: !FAIL_UPDATE,
        errorCode: FAIL_UPDATE ? 9102 : 0,
        errorMessage: FAIL_UPDATE ? 'Forced update callback failure' : '',
      });
    }

    return sendJson(res, {
      success: false,
      errorCode: 9004,
      errorMessage: 'Unknown route',
    });
  });
});

server.listen(PORT, () => {
  console.log(`Mock merchant callback server running on http://localhost:${PORT}`);
  console.log(`POST /login-player`);
  console.log(`POST /update-balance`);
});
