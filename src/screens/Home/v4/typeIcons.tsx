import React from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** The massage-type illustrations from the v4 Home design (HomeBlocks4), 48×48. */
export type TypeIconName = 'swedish' | 'deepTissue' | 'aroma' | 'thai' | 'ayurveda' | 'couples' | 'facial';

const icons: Record<TypeIconName, React.ReactElement> = {
  swedish: (
    <>
      <Defs>
        <LinearGradient id="tw" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F4EADB" />
          <Stop offset="1" stopColor="#CDBEA8" />
        </LinearGradient>
      </Defs>
      <Rect x="6" y="18" width="30" height="22" rx="11" fill="url(#tw)" />
      <Circle cx="36" cy="29" r="11" fill="#E8DCCA" />
      <Circle cx="36" cy="29" r="7" fill="none" stroke="#B9A88F" strokeWidth="1.6" />
      <Circle cx="36" cy="29" r="3.2" fill="none" stroke="#B9A88F" strokeWidth="1.6" />
      <Rect x="10" y="21" width="16" height="3" rx="1.5" fill="#fff" opacity={0.55} />
    </>
  ),
  deepTissue: (
    <>
      <Defs>
        <LinearGradient id="st" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#8B8580" />
          <Stop offset="1" stopColor="#4E4945" />
        </LinearGradient>
      </Defs>
      <Ellipse cx="24" cy="38" rx="17" ry="6.5" fill="url(#st)" />
      <Ellipse cx="24" cy="28" rx="13" ry="5.5" fill="url(#st)" />
      <Ellipse cx="24" cy="19" rx="9.5" ry="4.5" fill="url(#st)" />
      <Ellipse cx="20" cy="17.5" rx="4" ry="1.2" fill="#fff" opacity={0.35} />
      <Ellipse cx="18" cy="26.5" rx="5" ry="1.3" fill="#fff" opacity={0.25} />
      <Path
        d="M33 8c-2 2 2 3 0 5M38 9c-2 2 2 3 0 5"
        stroke="#C9B9A6"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        opacity={0.7}
      />
    </>
  ),
  aroma: (
    <>
      <Defs>
        <LinearGradient id="ob" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#C79E7C" />
          <Stop offset="1" stopColor="#7A5236" />
        </LinearGradient>
      </Defs>
      <Rect x="19" y="5" width="10" height="7" rx="2" fill="#6B5A4A" />
      <Rect x="20.5" y="11" width="7" height="5" fill="#B9A88F" />
      <Path d="M14 22a10 6 0 0 1 20 0v16a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z" fill="url(#ob)" />
      <Rect x="17" y="26" width="3" height="12" rx="1.5" fill="#fff" opacity={0.35} />
      <Rect x="18" y="30" width="12" height="7" rx="2" fill="#F4EADB" opacity={0.9} />
      <Path d="M38 28c-2 3-2 5 0 6 2-1 2-3 0-6z" fill="#D2B497" />
    </>
  ),
  thai: (
    <>
      <Defs>
        <RadialGradient id="hb" cx="0.35" cy="0.35" r="0.8">
          <Stop offset="0" stopColor="#F2E6D4" />
          <Stop offset="1" stopColor="#B8A587" />
        </RadialGradient>
      </Defs>
      <Circle cx="24" cy="30" r="13" fill="url(#hb)" />
      <Path d="M18 18c2 3 10 3 12 0l2-6-4 2-4-4-4 4-4-2z" fill="#CDBEA8" />
      <Rect x="17" y="17" width="14" height="3" rx="1.5" fill="#8DB39A" />
      <Path
        d="M17 29c3 2 6 2 9 0M20 34c2 1 5 1 7 0"
        stroke="#A8957A"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      <Path d="M36 10c4 1 5 4 4 7-3-1-5-3-4-7z" fill="#8DB39A" />
    </>
  ),
  ayurveda: (
    <>
      <Defs>
        <LinearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#9C8B78" />
          <Stop offset="1" stopColor="#5E5143" />
        </LinearGradient>
        <LinearGradient id="lf" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B5D6BE" />
          <Stop offset="1" stopColor="#5E9471" />
        </LinearGradient>
      </Defs>
      <Path d="M8 28h32a16 12 0 0 1-32 0z" fill="url(#bw)" />
      <Ellipse cx="24" cy="28" rx="16" ry="3.5" fill="#B7A68F" />
      <Path d="M22 26C14 22 13 12 19 6c6 6 6 15 3 20z" fill="url(#lf)" />
      <Path d="M26 26c2-7 8-11 14-10-2 6-7 10-14 10z" fill="#7FAE8D" />
      <Path d="M20 24c0-6 0-11-1-16" stroke="#3E6B4C" strokeWidth="1.2" fill="none" />
    </>
  ),
  couples: (
    <>
      <Defs>
        <LinearGradient id="cd" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F4EADB" />
          <Stop offset="1" stopColor="#C9B79F" />
        </LinearGradient>
        <RadialGradient id="fl" cx="0.5" cy="0.7" r="0.6">
          <Stop offset="0" stopColor="#FFF6E6" />
          <Stop offset="1" stopColor="#E2BE96" />
        </RadialGradient>
      </Defs>
      <Rect x="9" y="20" width="13" height="22" rx="3" fill="url(#cd)" />
      <Rect x="26" y="15" width="13" height="27" rx="3" fill="url(#cd)" />
      <Path d="M15.5 11c3 3 3 6 0 7-3-1-3-4 0-7z" fill="url(#fl)" />
      <Path d="M32.5 6c3 3 3 6 0 7-3-1-3-4 0-7z" fill="url(#fl)" />
      <Rect x="15" y="17" width="1" height="3" fill="#4A3F35" />
      <Rect x="32" y="12" width="1" height="3" fill="#4A3F35" />
    </>
  ),
  facial: (
    <>
      <Defs>
        <LinearGradient id="jr" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E8C2BE" />
          <Stop offset="1" stopColor="#B98581" />
        </LinearGradient>
      </Defs>
      <Rect x="10" y="12" width="28" height="8" rx="3" fill="#E9DCC9" />
      <Path d="M11 20h26v16a6 6 0 0 1-6 6H17a6 6 0 0 1-6-6z" fill="url(#jr)" />
      <Rect x="14" y="24" width="3" height="12" rx="1.5" fill="#fff" opacity={0.35} />
      <Circle cx="40" cy="10" r="2" fill="#F4EADB" />
      <Circle cx="7" cy="16" r="1.4" fill="#F4EADB" />
    </>
  ),
};

export function TypeIcon({ name, size = 40 }: { name: TypeIconName; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {icons[name]}
    </Svg>
  );
}
