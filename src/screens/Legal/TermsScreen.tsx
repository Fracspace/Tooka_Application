import React from 'react';

import LegalScreen from './components/LegalScreen';
import PoliciesV4 from './v4/PoliciesV4';
import { isV4 } from '../../config/uiFlags';
import { termsData } from './data/terms';

function TermsScreen(): React.ReactElement {
  if (isV4('policies')) {
    return <PoliciesV4 initialTab="terms" />;
  }
  return (
    <LegalScreen
      title={termsData.title}
      lastUpdated={termsData.lastUpdated}
      sections={termsData.sections}
    />
  );
}

export default TermsScreen;
