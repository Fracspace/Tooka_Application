export const CrashlyticsKeys = {
  USER_ID: 'user_id',
  USER_NAME: 'user_name',
  USER_PHONE: 'user_phone',

  SCREEN: 'screen',

  SPA_ID: 'spa_id',
  SPA_NAME: 'spa_name',

  BOOKING_ID: 'booking_id',
  BOOKING_REFERENCE: 'booking_reference',

  PAYMENT_ID: 'payment_id',

  CALL_SESSION_ID: 'call_session_id',
  CALL_STATE: 'call_state',

  APP_VERSION: 'app_version',
} as const;

export type CrashlyticsKey =
  (typeof CrashlyticsKeys)[keyof typeof CrashlyticsKeys];