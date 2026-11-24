import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'calendar' | 'qr' | 'dumbbell' | 'user' | 'flame' | 'pin' | 'chart'
  | 'chevron' | 'back' | 'bell' | 'check' | 'users' | 'scan' | 'plus' | 'logout' | 'clock' | 'close';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color = '#FFFFFF', strokeWidth = 1.8 }: Props) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />}
      {name === 'calendar' && (
        <>
          <Rect {...p} x={3} y={5} width={18} height={16} rx={2} />
          <Path {...p} d="M3 10h18M8 3v4M16 3v4" />
        </>
      )}
      {name === 'qr' && (
        <>
          <Rect {...p} x={3} y={3} width={7} height={7} rx={1} />
          <Rect {...p} x={14} y={3} width={7} height={7} rx={1} />
          <Rect {...p} x={3} y={14} width={7} height={7} rx={1} />
          <Path {...p} d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
        </>
      )}
      {name === 'dumbbell' && <Path {...p} d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12" />}
      {name === 'user' && (
        <>
          <Circle {...p} cx={12} cy={8} r={4} />
          <Path {...p} d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
        </>
      )}
      {name === 'users' && (
        <>
          <Circle {...p} cx={9} cy={8} r={3.5} />
          <Path {...p} d="M2.5 20c1.2-3.4 3.7-5 6.5-5s5.3 1.6 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c1.8.6 3 2.2 3.5 5" />
        </>
      )}
      {name === 'flame' && <Path {...p} d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.7 1.2 2.6 2.5 3 .2-3.2-1-5.5 0-8z" />}
      {name === 'pin' && (
        <>
          <Path {...p} d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" />
          <Circle {...p} cx={12} cy={9} r={2.5} />
        </>
      )}
      {name === 'chart' && <Path {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />}
      {name === 'chevron' && <Path {...p} d="m9 6 6 6-6 6" />}
      {name === 'back' && <Path {...p} d="m15 6-6 6 6 6" />}
      {name === 'bell' && <Path {...p} d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />}
      {name === 'check' && <Path {...p} d="m5 12 5 5 9-10" />}
      {name === 'scan' && <Path {...p} d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />}
      {name === 'plus' && <Path {...p} d="M12 5v14M5 12h14" />}
      {name === 'close' && <Path {...p} d="M6 6l12 12M18 6 6 18" />}
      {name === 'logout' && <Path {...p} d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H4" />}
      {name === 'clock' && (
        <>
          <Circle {...p} cx={12} cy={12} r={9} />
          <Path {...p} d="M12 7v5l3 2" />
        </>
      )}
    </Svg>
  );
}
