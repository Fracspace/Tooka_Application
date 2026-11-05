import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mapBackendStatusToCategory } from '../../../payment/PaymentMapper';
import {
  BackendPaymentStatus,
  PaymentFlowState,
} from '../../../payment/PaymentTypes';

interface PaymentStatusBadgeProps {
  flowState?: PaymentFlowState;
  backendStatus?: BackendPaymentStatus;
}

const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  success: { background: '#E8F8EE', text: '#1F8A4C' },
  failure: { background: '#FDECEC', text: '#D94A45' },
  cancelled: { background: '#FFF0D6', text: '#C77700' },
  expired: { background: '#FDECEC', text: '#D94A45' },
  processing: { background: '#FFF0D6', text: '#C77700' },
  unknown: { background: '#F3F3F3', text: '#666666' },
};

export const FLOW_LABELS: Record<PaymentFlowState, string> = {
  [PaymentFlowState.Idle]: 'Ready',
  [PaymentFlowState.Ready]: 'Ready',
  [PaymentFlowState.SdkOpening]: 'Opening Payment Gateway',
  [PaymentFlowState.SdkOpen]: 'Waiting For Payment',
  [PaymentFlowState.Verifying]: 'Verifying Payment',
  [PaymentFlowState.Success]: 'Payment Successful',
  [PaymentFlowState.Failed]: 'Payment Failed',
  [PaymentFlowState.Cancelled]: 'Payment Cancelled',
  [PaymentFlowState.Refunded]: 'Payment Refunded',
  [PaymentFlowState.Timeout]: 'Still Processing',
  [PaymentFlowState.Error]: 'Payment Error',
};

function PaymentStatusBadgeComponent({
  flowState = PaymentFlowState.Idle,
  backendStatus,
}: PaymentStatusBadgeProps): React.ReactElement {
  const category = backendStatus
    ? mapBackendStatusToCategory(backendStatus)
    : flowState === PaymentFlowState.Failed ||
      flowState === PaymentFlowState.Error ||
      flowState === PaymentFlowState.Refunded
    ? 'failure'
    : flowState === PaymentFlowState.Success
    ? 'success'
    : flowState === PaymentFlowState.Cancelled
    ? 'cancelled'
    : flowState === PaymentFlowState.SdkOpening ||
      flowState === PaymentFlowState.SdkOpen ||
      flowState === PaymentFlowState.Verifying ||
      flowState === PaymentFlowState.Timeout
    ? 'processing'
    : 'unknown';

  const colors = STATUS_COLORS[category] ?? STATUS_COLORS.unknown;
  const label = backendStatus
    ? backendStatus.replace(/_/g, ' ')
    : FLOW_LABELS[flowState];

  const formattedLabel = useMemo(
    () => label.charAt(0).toUpperCase() + label.slice(1),
    [label],
  );

  return (
    <View
      style={[styles.badge, { backgroundColor: colors.background }]}
      accessibilityRole="text"
      accessibilityLabel={`Payment status ${formattedLabel}`}
    >
      <Text style={[styles.text, { color: colors.text }]}>
        {formattedLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontFamily: 'WorkSans-SemiBold',
    fontSize: 13,
    textTransform: 'capitalize',
  },
});

export const PaymentStatusBadge = memo(PaymentStatusBadgeComponent);
export default PaymentStatusBadge;
