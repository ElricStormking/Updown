export const IntegrationErrorCodes = {
  SUCCESS: 0,
  INVALID_SIGNATURE: 1001,
  TIMESTAMP_EXPIRED: 1002,
  MERCHANT_NOT_FOUND: 1003,
  MERCHANT_INACTIVE: 1004,
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
  INTERNAL_ERROR: 9999,
} as const;

export const IntegrationErrorMessages: Record<number, string> = {
  [IntegrationErrorCodes.SUCCESS]: '',
  [IntegrationErrorCodes.INVALID_SIGNATURE]: 'Invalid signature',
  [IntegrationErrorCodes.TIMESTAMP_EXPIRED]: 'Timestamp expired or invalid',
  [IntegrationErrorCodes.MERCHANT_NOT_FOUND]: 'Merchant not found',
  [IntegrationErrorCodes.MERCHANT_INACTIVE]: 'Merchant is inactive',
  [IntegrationErrorCodes.ACCOUNT_ALREADY_EXISTS]: 'Account already exists',
  [IntegrationErrorCodes.ACCOUNT_NOT_FOUND]: 'Account not found',
  [IntegrationErrorCodes.ACCOUNT_DISABLED]: 'Account is disabled',
  [IntegrationErrorCodes.INSUFFICIENT_BALANCE]: 'Insufficient balance',
  [IntegrationErrorCodes.DUPLICATE_ORDER_NUMBER]: 'Duplicate transfer ID',
  [IntegrationErrorCodes.INVALID_TRANSFER_TYPE]: 'Invalid transfer type',
  [IntegrationErrorCodes.INVALID_PAGE_SIZE]:
    'Page size must be between 1 and 100',
  [IntegrationErrorCodes.INVALID_PAGE_NUMBER]: 'Invalid page number',
  [IntegrationErrorCodes.INVALID_BET_AMOUNT_LIMIT]:
    'Invalid bet amount limit',
  [IntegrationErrorCodes.INVALID_TOKEN_VALUES]:
    'Invalid token values',
  [IntegrationErrorCodes.INTERNAL_ERROR]: 'Internal server error',
};
