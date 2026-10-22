import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * Line icons drawn from the v4 designs (24×24, round caps). Add more here as
 * screens need them, so every v4 screen draws icons the same way.
 */
const ICONS = {
  back: (
    <Path d="m15 18-6-6 6-6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  ),
  arrowRight: (
    <Path d="M5 12h14M13 6l6 6-6 6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  ),
  chevronDown: <Path d="m6 9 6 6 6-6" strokeWidth={2.6} strokeLinecap="round" />,
  home: <Path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" strokeLinejoin="round" />,
  explore: <Path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" strokeLinejoin="round" />,
  bookings: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={3} />
      <Path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  profile: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <Circle cx={12} cy={9.5} r={2.5} />
    </>
  ),
  clock: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" strokeLinecap="round" />
    </>
  ),
  lock: (
    <>
      <Rect x={5} y={11} width={14} height={10} rx={2} />
      <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  directions: <Path d="m3 11 18-8-8 18-2-8z" strokeLinejoin="round" />,
  phone: (
    <Path
      d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"
      strokeLinejoin="round"
    />
  ),
  check: <Path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />,
  close: <Path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  chevronRight: <Path d="m9 18 6-6-6-6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />,
  plus: <Path d="M12 5v14M5 12h14" strokeWidth={2.4} strokeLinecap="round" />,
  bell: (
    <>
      <Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 21h4" strokeLinecap="round" />
    </>
  ),
  mail: (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={3} strokeLinejoin="round" />
      <Path d="m4 7 8 6 8-6" strokeLinejoin="round" />
    </>
  ),
  camera: (
    <>
      <Path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.5} />
    </>
  ),
  edit: <Path d="M4 20h4L19 9l-4-4L4 16z" strokeLinecap="round" strokeLinejoin="round" />,
  card: (
    <>
      <Rect x={3} y={6} width={18} height={13} rx={3} strokeLinejoin="round" />
      <Path d="M3 10h18M7 15h4" />
    </>
  ),
  star: <Path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" strokeLinejoin="round" />,
  doc: (
    <>
      <Path d="M6 3h9l4 4v14H6z" strokeLinejoin="round" />
      <Path d="M9 11h7M9 15h7" />
    </>
  ),
  shield: <Path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" strokeLinejoin="round" />,
  refund: (
    <>
      <Path d="M3 12a9 9 0 1 0 3-6.7L3 8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  logout: (
    <>
      <Path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  trash: <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />,
  calendar: (
    <>
      <Rect x={4} y={5} width={16} height={15} rx={3} />
      <Path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 2 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      accessible={false}>
      {ICONS[name]}
    </Svg>
  );
}
