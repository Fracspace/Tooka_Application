/**
 * Switches between the old layouts and the v4 redesign.
 *
 * Old and v4 layouts of a screen read from the same hook, so flipping a switch
 * changes only how the screen looks, never what it does. A screen shows v4
 * only when both the master switch and its own switch are on. All of v4 ships
 * together; once it is approved the old layouts and these switches go away.
 */
export const USE_V4_UI = true;

export const V4_SCREENS = {
  spaDetails: true,
  reviewAndPay: true,
  booked: true,
  home: true,
  explore: true,
  bookings: true,
  tabBar: true,
  profile: true,
  editProfile: true,
  paymentHistory: false,
  policies: false,
} as const;

export type V4Screen = keyof typeof V4_SCREENS;

export const isV4 = (screen: V4Screen): boolean => USE_V4_UI && V4_SCREENS[screen];

/** Development only: show the v4 component gallery instead of the app. */
export const SHOW_V4_GALLERY = false;
