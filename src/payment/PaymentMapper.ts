import axios from 'axios';

import {
  BackendPaymentStatus,
  PaymentResultType,
  PaymentStatusCategory,
  SdkPaymentResult,
  type InitiatePaymentResponse,
  type PaymentErrorDetails,
  type PaymentVerificationResponse,
} from './PaymentTypes';
import { PAYMENT_USER_MESSAGES } from './constants';

type UnknownRecord = Record<string, unknown>;

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const unwrapPayload = <T extends UnknownRecord>(
  payload: T | { data?: T },
): T => {
  const record = payload as { data?: T };
  if (record.data && typeof record.data === 'object') {
    return record.data;
  }

  return payload as T;
};

const normalizeBackendStatus = (value: unknown): BackendPaymentStatus => {
  const normalized = asString(value)?.toLowerCase().replace(/-/g, '_');

  switch (normalized) {
    case BackendPaymentStatus.Initiated:
      return BackendPaymentStatus.Initiated;
    case BackendPaymentStatus.Pending:
      return BackendPaymentStatus.Pending;
    case BackendPaymentStatus.Processing:
      return BackendPaymentStatus.Processing;
    case BackendPaymentStatus.Captured:
      return BackendPaymentStatus.Captured;
    case BackendPaymentStatus.Refunded:
      return BackendPaymentStatus.Refunded;
    case BackendPaymentStatus.Failed:
      return BackendPaymentStatus.Failed;
    default:
      // Was Initiated, which quietly turned statuses like 'expired' or 'cancelled'
      // into "not started yet" and kept polling them.
      return BackendPaymentStatus.Unknown;
  }
};

export const mapInitiatePaymentResponse = (
  payload: unknown,
): InitiatePaymentResponse => {
  const record = unwrapPayload((asRecord(payload) ?? {}) as UnknownRecord);
  const paymentId =
    asString(record.payment_id) ?? asString(record.paymentId) ?? '';
  const paymentSessionId =
    asString(record.payment_session_id) ??
    asString(record.paymentSessionId) ??
    '';
  const cashfreeOrderId =
    asString(record.cashfree_order_id) ??
    asString(record.cashfreeOrderId) ??
    asString(record.order_id) ??
    '';
  const orderAmount =
    asNumber(record.order_amount) ?? asNumber(record.orderAmount);
  const orderCurrency =
    asString(record.order_currency) ?? asString(record.orderCurrency) ?? 'INR';

  // A missing amount used to become 0, so the screen said "Amount Payable ₹0".
  if (
    !paymentId ||
    !paymentSessionId ||
    !cashfreeOrderId ||
    orderAmount === undefined ||
    orderAmount <= 0
  ) {
    throw new Error('Payment initiation response is incomplete.');
  }

  return {
    payment_id: paymentId,
    payment_session_id: paymentSessionId,
    cashfree_order_id: cashfreeOrderId,
    order_amount: orderAmount,
    order_currency: orderCurrency,
  };
};

export const mapPaymentVerificationResponse = (
  payload: unknown,
): PaymentVerificationResponse => {
  const record = unwrapPayload((asRecord(payload) ?? {}) as UnknownRecord);
  const paymentId =
    asString(record.payment_id) ?? asString(record.paymentId) ?? '';
  const status = normalizeBackendStatus(record.status);
  const failureReason =
    asString(record.failure_reason) ??
    asString(record.failureReason) ??
    asString(record.reason) ??
    null;

  return {
    payment_id: paymentId,
    status,
    failure_reason: failureReason,
    booking_id: asString(record.booking_id) ?? asString(record.bookingId),
    cashfree_order_id:
      asString(record.cashfree_order_id) ?? asString(record.cashfreeOrderId),
    order_amount: asNumber(record.order_amount) ?? asNumber(record.orderAmount),
    order_currency:
      asString(record.order_currency) ?? asString(record.orderCurrency),
    paid_at: asString(record.paid_at) ?? asString(record.paidAt) ?? null,
  };
};

export const mapBackendStatusToCategory = (
  status: BackendPaymentStatus,
): PaymentStatusCategory => {
  switch (status) {
    case BackendPaymentStatus.Captured:
      return 'success';
    case BackendPaymentStatus.Failed:
    case BackendPaymentStatus.Refunded:
      return 'failure';
    case BackendPaymentStatus.Initiated:
    case BackendPaymentStatus.Pending:
    case BackendPaymentStatus.Processing:
      return 'processing';
    default:
      return 'unknown';
  }
};

export const mapCategoryToResultType = (
  category: PaymentStatusCategory,
): PaymentResultType => {
  switch (category) {
    case 'success':
      return 'success';
    case 'processing':
      return 'processing';
    default:
      return 'failure';
  }
};

export const mapSdkErrorToResult = (error: {
  getMessage?: () => string;
  getCode?: () => string;
}): SdkPaymentResult => {
  const message = error.getMessage?.()?.toLowerCase() ?? '';
  const code = error.getCode?.()?.toLowerCase() ?? '';

  if (
    message.includes('cancel') ||
    code.includes('cancel') ||
    message.includes('user pressed back')
  ) {
    return SdkPaymentResult.Cancelled;
  }

  if (message.includes('fail') || code.includes('fail')) {
    return SdkPaymentResult.Failed;
  }

  return SdkPaymentResult.Unknown;
};

export const mapPaymentError = (error: unknown): PaymentErrorDetails => {
  if (axios.isCancel(error)) {
    return {
      userMessage: '',
      isRetryable: true,
      isNetworkError: false,
      isAuthError: false,
    };
  }

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    const data = asRecord(error.response?.data);
    const apiMessage = asString(data?.message);

    if (statusCode === 401) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.sessionExpired,
        isRetryable: false,
        isNetworkError: false,
        isAuthError: true,
      };
    }

    if (statusCode === 403) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.forbidden,
        isRetryable: false,
        isNetworkError: false,
        isAuthError: true,
      };
    }

    if (statusCode === 404) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.notFound,
        isRetryable: false,
        isNetworkError: false,
        isAuthError: false,
      };
    }

    if (statusCode === 409) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.conflict,
        isRetryable: true,
        isNetworkError: false,
        isAuthError: false,
      };
    }

    if (statusCode === 422) {
      return {
        statusCode,
        userMessage: apiMessage ?? PAYMENT_USER_MESSAGES.validation,
        isRetryable: false,
        isNetworkError: false,
        isAuthError: false,
      };
    }

    if (statusCode === 429) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.rateLimited,
        isRetryable: true,
        isNetworkError: false,
        isAuthError: false,
      };
    }

    if (statusCode && statusCode >= 500) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.serverError,
        isRetryable: true,
        isNetworkError: false,
        isAuthError: false,
      };
    }

    if (
      error.code === 'ECONNABORTED' ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('timeout')
    ) {
      return {
        statusCode,
        userMessage: PAYMENT_USER_MESSAGES.offline,
        isRetryable: true,
        isNetworkError: true,
        isAuthError: false,
      };
    }

    return {
      statusCode,
      userMessage: apiMessage ?? PAYMENT_USER_MESSAGES.generic,
      isRetryable: true,
      isNetworkError: false,
      isAuthError: false,
    };
  }

  if (error instanceof Error) {
    if (
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('offline')
    ) {
      return {
        userMessage: PAYMENT_USER_MESSAGES.offline,
        isRetryable: true,
        isNetworkError: true,
        isAuthError: false,
      };
    }

    return {
      userMessage: PAYMENT_USER_MESSAGES.generic,
      isRetryable: true,
      isNetworkError: false,
      isAuthError: false,
    };
  }

  return {
    userMessage: PAYMENT_USER_MESSAGES.generic,
    isRetryable: true,
    isNetworkError: false,
    isAuthError: false,
  };
};

export const formatPaymentAmount = (
  amount: number,
  currency: string,
): string => {
  const normalizedCurrency = currency.toUpperCase();

  if (normalizedCurrency === 'INR') {
    return `₹${amount.toLocaleString('en-IN')}`;
  }

  return `${normalizedCurrency} ${amount.toLocaleString('en-IN')}`;
};
