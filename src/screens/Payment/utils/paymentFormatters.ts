import { toSafeNumber } from '../../../utils/number';

type PaymentStatusUI = {
  label: string;
  textColor: string;
  backgroundColor: string;
};

const STATUS_COLORS = {
  completed: { text: '#2DB87A', bg: '#E6F9EF' },
  pending: { text: '#D28A00', bg: '#FFF0D4' },
  failed: { text: '#D94A45', bg: '#FBE9E8' },
  refunded: { text: '#007AFF', bg: '#E5F1FF' },
  default: { text: '#8A8A8A', bg: '#F5F5F5' },
};

export function getPaymentStatusUI(
  paymentStatus: string | null | undefined,
): PaymentStatusUI {
  if (!paymentStatus) {
    return {
      label: 'Unknown',
      textColor: STATUS_COLORS.default.text,
      backgroundColor: STATUS_COLORS.default.bg,
    };
  }

  const normalized = paymentStatus.trim().toLowerCase();

  switch (normalized) {
    case 'captured':
    case 'completed':
    case 'success':
      return {
        label: 'Completed',
        textColor: STATUS_COLORS.completed.text,
        backgroundColor: STATUS_COLORS.completed.bg,
      };
    case 'initiated':
    case 'pending':
    case 'processing':
      return {
        label: 'Pending',
        textColor: STATUS_COLORS.pending.text,
        backgroundColor: STATUS_COLORS.pending.bg,
      };
    case 'cancelled':
    case 'cancelled_by_user':
    case 'cancelled_by_spa':
    case 'expired':
    case 'failed':
    case 'chargeback':
      return {
        label: normalized.includes('cancel') || normalized === 'expired' ? 'Cancelled' : 'Failed',
        textColor: STATUS_COLORS.failed.text,
        backgroundColor: STATUS_COLORS.failed.bg,
      };
    case 'refunded':
    case 'partially_refunded':
      return {
        label: 'Refunded',
        textColor: STATUS_COLORS.refunded.text,
        backgroundColor: STATUS_COLORS.refunded.bg,
      };
    default:
      return {
        label: normalized
          .replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase()),
        textColor: STATUS_COLORS.default.text,
        backgroundColor: STATUS_COLORS.default.bg,
      };
  }
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) {
    return '₹0';
  }
  const safeAmount = toSafeNumber(amount, 0);
  // Add commas and remove decimals if they are .00
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount);

  // Fallback if Intl doesn't include the symbol correctly
  return formatted.includes('₹') ? formatted : `₹${formatted}`;
}

export function extractPaymentDate(
  rawRecord: Record<string, unknown> | undefined,
): string | undefined {
  if (!rawRecord) return undefined;

  // Check payment.payment_time first
  const payment = rawRecord.payment as Record<string, unknown> | undefined;
  if (typeof payment?.payment_time === 'string' && payment.payment_time.trim()) {
    return payment.payment_time;
  }

  // Use updated_at or created_at as best available proxy until a dedicated timestamp exists
  const timestamp =
    rawRecord.updated_at ||
    rawRecord.createdAt ||
    rawRecord.created_at ||
    rawRecord.appointment_at ||
    rawRecord.appointmentAt;

  if (typeof timestamp !== 'string' || !timestamp.trim()) {
    return undefined;
  }

  return timestamp;
}

export function formatDateTime(isoString: string | undefined): string | undefined {
  if (!isoString) return undefined;

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return undefined;

  const formattedDate = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${formattedDate} | ${formattedTime.toUpperCase()}`;
}

export function formatPaymentMethod(payment: unknown): { label: string; icon: string } {
  if (!payment || typeof payment !== 'object') {
    return { label: 'Payment Method Unavailable', icon: 'card-outline' };
  }

  const p = payment as Record<string, any>;
  const method = p.payment_method;

  // Card details
  if (method?.card) {
    const network = method.card.card_network || 'Card';
    const number = method.card.card_number ? String(method.card.card_number).trim() : '';
    const last4 = number.length >= 4 ? number.slice(-4) : (method.card.last4 || '');
    return {
      label: last4 ? `${network} •••• ${last4}` : network,
      icon: 'card-outline',
    };
  }

  // UPI details
  if (method?.upi) {
    const upiId = method.upi.upi_id || method.upi.channel || 'UPI';
    return {
      label: upiId,
      icon: 'card-outline',
    };
  }

  // Netbanking
  if (method?.netbanking) {
    const bankName = method.netbanking.netbanking_bank_name || method.netbanking.channel || 'Netbanking';
    return {
      label: bankName,
      icon: 'business-outline',
    };
  }

  // Wallet / App
  if (method?.app || method?.wallet) {
    const provider = method.app?.provider || method.wallet?.provider || 'Wallet';
    return {
      label: provider,
      icon: 'wallet-outline',
    };
  }

  // Payment group fallback
  if (p.payment_group) {
    const group = String(p.payment_group).toUpperCase();
    return {
      label: group === 'UPI' ? 'UPI Payment' : group,
      icon: 'card-outline',
    };
  }

  if (p.displayName || p.type) {
    return {
      label: String(p.displayName || p.type),
      icon: 'card-outline',
    };
  }

  return { label: 'Payment Method Unavailable', icon: 'card-outline' };
}
