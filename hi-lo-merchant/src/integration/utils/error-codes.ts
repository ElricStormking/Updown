export const IntegrationErrorCodes = {
  SUCCESS: 0,
  INVALID_SIGNATURE: 1001,
  TIMESTAMP_EXPIRED: 1002,
  MERCHANT_NOT_FOUND: 1003,
  MERCHANT_INACTIVE: 1004,
  IP_NOT_ALLOWED: 1005,
  ACCOUNT_ALREADY_EXISTS: 2001,
  ACCOUNT_NOT_FOUND: 2002,
  ACCOUNT_DISABLED: 2003,
  INSUFFICIENT_BALANCE: 3001,
  DUPLICATE_ORDER_NUMBER: 3002,
  INVALID_TRANSFER_TYPE: 3003,
  INVALID_PAGE_SIZE: 4001,
  INVALID_PAGE_NUMBER: 4002,
  INVALID_BET_AMOUNT_LIMIT: 5001,
  INVALID_TOKEN_VALUES: 5002,
  CALLBACK_FIELDS_REQUIRED: 6001,
  CALLBACK_MERCHANT_NOT_CONFIGURED: 6002,
  LAUNCH_SESSION_NOT_FOUND: 6003,
  LAUNCH_SESSION_NOT_ACTIVE: 6004,
  LOGIN_PLAYER_CALLBACK_FAILED: 6005,
  UPDATE_BALANCE_CALLBACK_FAILED: 6006,
  INTERNAL_ERROR: 9999,
} as const;

export const IntegrationErrorMessages: Record<number, string> = {
  [IntegrationErrorCodes.SUCCESS]: '',
  [IntegrationErrorCodes.INVALID_SIGNATURE]: 'Invalid signature',
  [IntegrationErrorCodes.TIMESTAMP_EXPIRED]: 'Timestamp expired or invalid',
  [IntegrationErrorCodes.MERCHANT_NOT_FOUND]: 'Merchant not found',
  [IntegrationErrorCodes.MERCHANT_INACTIVE]: 'Merchant is inactive',
  [IntegrationErrorCodes.IP_NOT_ALLOWED]: 'Client IP is not in merchant whitelist',
  [IntegrationErrorCodes.ACCOUNT_ALREADY_EXISTS]: 'Account already exists',
  [IntegrationErrorCodes.ACCOUNT_NOT_FOUND]: 'Account not found',
  [IntegrationErrorCodes.ACCOUNT_DISABLED]: 'Account is disabled',
  [IntegrationErrorCodes.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [IntegrationErrorCodes.DUPLICATE_ORDER_NUMBER]: 'Duplicate transfer ID',
  [IntegrationErrorCodes.INVALID_TRANSFER_TYPE]: 'Invalid transfer type',
  [IntegrationErrorCodes.INVALID_PAGE_SIZE]:
    'Page size must be between 1 and 100',
  [IntegrationErrorCodes.INVALID_PAGE_NUMBER]: 'Invalid page number',
  [IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT]: 'Invalid bet amount limit',
  [IntegrationErrorCodes.INVALID_TOKEN_VALUES]: 'Invalid token values',
  [IntegrationErrorCodes.CALLBACK_FIELDS_REQUIRED]:
    'Callback mode requires playerId and accessToken',
  [IntegrationErrorCodes.CALLBACK_MERCHANT_NOT_CONFIGURED]:
    'Merchant callback mode is not configured',
  [IntegrationErrorCodes.LAUNCH_SESSION_NOT_FOUND]: 'Launch session not found',
  [IntegrationErrorCodes.LAUNCH_SESSION_NOT_ACTIVE]:
    'Launch session is not active',
  [IntegrationErrorCodes.LOGIN_PLAYER_CALLBACK_FAILED]:
    'LoginPlayer callback failed',
  [IntegrationErrorCodes.UPDATE_BALANCE_CALLBACK_FAILED]:
    'UpdateBalance callback failed',
  [IntegrationErrorCodes.INTERNAL_ERROR]: 'Internal server error',
};
