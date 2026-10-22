/**
 * v4 design tokens, taken from the approved `*4.dc.html` screens on the design
 * canvas (dark espresso surfaces, Tooka saffron as the one bright colour).
 *
 * Shadows and gradients are CSS strings: React Native's New Architecture
 * renders `boxShadow` (including `inset`) and `experimental_backgroundImage`
 * natively, so they map one-to-one onto the design's CSS.
 */
import { Easing } from 'react-native-reanimated';

export const colors = {
  bg: '#12100E',
  s1: '#1D1915',
  s2: '#28221D',
  s3: '#373029',
  edge: 'rgba(255,240,224,0.08)',
  edgeHi: 'rgba(255,240,224,0.14)',
  /** Translucent fill for buttons that sit on the page background. */
  soft: 'rgba(255,240,224,0.07)',
  /** Translucent fill for buttons that sit on photos. */
  glass: 'rgba(18,16,14,0.45)',
  glassEdge: 'rgba(255,240,224,0.16)',

  text: '#FBF3E8',
  muted: '#B6A999',
  subtle: '#8E8274',
  cream: '#E9DCC9',
  ink: '#17120E',

  brand: '#FFB02E',
  brand2: '#FFC266',
  brandDeep: '#C98516',
  brandTint: '#3A2A12',
  onBrand: '#241C15',
  /** Small text on a saffron fill (e.g. the weekday on Home's date box). */
  onBrandMuted: '#6B4500',

  sage: '#9CC7A8',
  danger: '#F08A7E',
  me: '#8EC5FF',
  map: '#16130F',
} as const;

/** Tooka saffron at a given opacity. */
export const brandAlpha = (a: number) => `rgba(255,176,46,${a})`;

export const fonts = {
  display: 'Sora-SemiBold',
  displayMedium: 'Sora-Medium',
  displayRegular: 'Sora-Regular',
  displayBold: 'Sora-Bold',
  body: 'WorkSans-Regular',
  bodyMedium: 'WorkSans-Medium',
  bodySemiBold: 'WorkSans-SemiBold',
  bodyBold: 'WorkSans-Bold',
} as const;

/** Text styles. Letter spacing is the design's `em` value times the font size. */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 22, lineHeight: 36, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.display, fontSize: 22, lineHeight: 32, letterSpacing: -0.65 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  cardTitle: { fontFamily: fonts.display, fontSize: 16, lineHeight: 21 },
  itemTitle: { fontFamily: fonts.display, fontSize: 14, lineHeight: 19 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 16 },
  overline: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13, letterSpacing: 1.54 },
  tab: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13 },
  button: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
  price: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20 },
} as const;

export const radii = {
  xs: 11,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  card: 24,
  poster: 26,
  hero: 32,
  pill: 999,
} as const;

export const space = {
  gutter: 16,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const shadows = {
  /** Card edge: a faint top highlight plus a 1px ring. */
  card: 'inset 0 1px 0 rgba(255,240,224,0.14), inset 0 0 0 1px rgba(255,240,224,0.08)',
  ring: 'inset 0 0 0 1px rgba(255,240,224,0.08)',
  ringHi: 'inset 0 0 0 1px rgba(255,240,224,0.14)',
  brandRing: 'inset 0 0 0 1px rgba(255,176,46,0.24)',
  brandRingStrong: 'inset 0 0 0 1px rgba(255,176,46,0.45)',
  cta: '0 8px 22px rgba(255,176,46,0.26)',
  pay: '0 10px 26px rgba(255,176,46,0.3)',
  selected: '0 6px 16px rgba(255,176,46,0.28)',
  tabBar: 'inset 0 0 0 1px rgba(255,176,46,0.12), 0 14px 34px rgba(0,0,0,0.5)',
  float: '0 16px 36px rgba(0,0,0,0.5)',
} as const;

export const gradients = {
  /** Raised tiles (Home type tiles, amenity tiles). */
  raised: 'linear-gradient(180deg, #221D18 0%, #1A1612 100%)',
  /** The saffron-tinted "Your next visit" card. */
  brandCard: 'linear-gradient(135deg, #3A2A12 0%, #241C15 55%, #1A1612 100%)',
  /** The soft saffron glow at the top of a screen. */
  haze: 'radial-gradient(120% 70% at 50% -10%, rgba(255,176,46,0.26) 0%, rgba(255,176,46,0.08) 44%, rgba(255,176,46,0) 74%)',
  /** Fades content out behind a bottom dock. */
  dock: 'linear-gradient(180deg, rgba(18,16,14,0) 0%, rgba(18,16,14,0.92) 34%, #12100E 100%)',
  sheen: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)',
} as const;

/**
 * Motion: presses 120ms, selections 220–260ms with a small spring, entrances
 * 360–560ms. Everything stops when the phone's reduce-motion setting is on.
 */
export const motion = {
  press: 120,
  select: 240,
  enter: 460,
  rise: 560,
  image: 700,
  stagger: 60,
  pressScale: 0.97,
  /** cubic-bezier(.22,1,.36,1): fast start, long soft landing. */
  out: Easing.bezier(0.22, 1, 0.36, 1),
  /** cubic-bezier(.34,1.56,.64,1): a small overshoot. */
  spring: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const theme = { colors, fonts, type, radii, space, shadows, gradients, motion };
export type Theme = typeof theme;
