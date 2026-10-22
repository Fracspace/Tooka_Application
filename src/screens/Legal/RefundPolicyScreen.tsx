import React from 'react';

import LegalScreen from './components/LegalScreen';
import PoliciesV4 from './v4/PoliciesV4';
import { isV4 } from '../../config/uiFlags';
import { refundData } from './data/refund';

function RefundPolicyScreen(): React.ReactElement {
  if (isV4('policies')) {
    return <PoliciesV4 initialTab="refund" />;
  }
  return (
    <LegalScreen
      title={refundData.title}
      lastUpdated={refundData.lastUpdated}
      sections={refundData.sections}
    />
  );
}

export default RefundPolicyScreen;
