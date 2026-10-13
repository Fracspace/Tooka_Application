export enum PaymentFlowState {
  Idle = 'IDLE',
  Ready = 'READY',
  SdkOpening = 'SDK_OPENING',
  SdkOpen = 'SDK_OPEN',
  Verifying = 'VERIFYING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Refunded = 'REFUNDED',
  Timeout = 'TIMEOUT',
  Error = 'ERROR',
}

export enum BackendPaymentStatus {
  Initiated = 'initiated',
  Pending = 'pending',
  Processing = 'processing',
  Captured = 'captured',
  Refunded = 'refunded',
  Failed = 'failed',
  // A status this app does not recognise. Never treated as paid or as safe to retry.
  Unknown = 'unknown',
}

export enum SdkPaymentResult {
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
  Unknown = 'UNKNOWN',
}

export enum PaymentType {
  BookingAmount = 'booking_amount',
}

export type PaymentResultType =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'refunded'
  | 'timeout'
  | 'processing';

export interface InitiatePaymentPayload {
  booking_id: string;
  payment_type: PaymentType.BookingAmount;
}

export interface InitiatePaymentResponse {
  payment_id: string;
  payment_session_id: string;
  cashfree_order_id: string;
  order_amount: number;
  order_currency: string;
}

export interface PaymentVerificationResponse {
  payment_id: string;
  status: BackendPaymentStatus;
  failure_reason?: string | null;
  booking_id?: string;
  cashfree_order_id?: string;
  order_amount?: number;
  order_currency?: string;
  paid_at?: string | null;
}

export interface PaymentSessionData {
  paymentId: string;
  bookingId: string;
  bookingRef?: string;
  paymentSessionId: string;
  cashfreeOrderId: string;
  amount: number;
  currency: string;
}

export interface BookingSummaryData {
  spaName?: string;
  spaImage?: string;
  location?: string;
  serviceName?: string;
  serviceDurationMinutes?: number | null;
  appointmentDate?: string;
  appointmentTime?: string;
  bookingDateAndTime?: string;
}

export interface PaymentFlowContext
  extends PaymentSessionData,
    BookingSummaryData {
  flowState: PaymentFlowState;
  failureReason?: string;
  userMessage?: string;
  sdkLaunched: boolean;
}

export interface PaymentErrorDetails {
  code?: string;
  statusCode?: number;
  userMessage: string;
  isRetryable: boolean;
  isNetworkError: boolean;
  isAuthError: boolean;
}

export type PaymentStatusCategory =
  | 'success'
  | 'failure'
  | 'processing'
  | 'unknown';
