import React from 'react';

import EditProfileV4 from '../v4/EditProfileV4';
import { useEditProfileScreen } from '../../../hooks/useEditProfileScreen';

/** How long v4 shows "Saved" on the button before going back. */
const SAVED_HOLD_MS = 900;

function EditProfileScreen(): React.ReactElement {
  const screen = useEditProfileScreen({ savedHoldMs: SAVED_HOLD_MS });
  return <EditProfileV4 {...screen} />;
}

export default EditProfileScreen;
