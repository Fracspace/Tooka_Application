import React from 'react';

import EditProfileView from './EditProfileView';
import { useEditProfileScreen } from '../../../hooks/useEditProfileScreen';

/** How long the view shows "Saved" on the button before going back. */
const SAVED_HOLD_MS = 900;

function EditProfileScreen(): React.ReactElement {
  const screen = useEditProfileScreen({ savedHoldMs: SAVED_HOLD_MS });
  return <EditProfileView {...screen} />;
}

export default EditProfileScreen;
