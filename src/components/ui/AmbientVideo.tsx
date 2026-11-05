import React, { forwardRef } from 'react';
import Video, { type ReactVideoProps, type VideoRef } from 'react-native-video';

/**
 * A silent video that never stops the user's music or podcast. Use it for
 * every video in the app instead of react-native-video's Video directly.
 *
 * - muted: our videos are decorative; no sound is played.
 * - mixWithOthers "mix" (iOS) and disableFocus (Android): the video does not
 *   take the phone's audio, so background audio keeps playing. The splash
 *   video used to pause it on every launch.
 * - ignoreSilentSwitch "obey": the video never forces sound on silent mode.
 */
export const AmbientVideo = forwardRef<VideoRef, ReactVideoProps>(function AmbientVideoView(props, ref) {
  return (
    <Video
      {...props}
      ref={ref}
      muted
      mixWithOthers="mix"
      disableFocus
      ignoreSilentSwitch="obey"
    />
  );
});
