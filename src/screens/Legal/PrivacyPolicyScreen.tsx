import React from 'react';

import LegalScreen from './components/LegalScreen';
import PoliciesV4 from './v4/PoliciesV4';
import { isV4 } from '../../config/uiFlags';
import { privacyData } from './data/privacy';

function PrivacyPolicyScreen(): React.ReactElement {
  if (isV4('policies')) {
    return <PoliciesV4 initialTab="privacy" />;
  }
  return (
    <LegalScreen
      title={privacyData.title}
      lastUpdated={privacyData.lastUpdated}
      sections={privacyData.sections}
    />
  );
}

export default PrivacyPolicyScreen;
