import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Minimal line-icon set, drawn in-house to avoid a generic icon-font look. */
const paths = {
  'chevron-left': 'M15 5 L8 12 L15 19',
  'chevron-right': 'M9 5 L16 12 L9 19',
  close: 'M6 6 L18 18 M18 6 L6 18',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  minus: 'M5 12 L19 12',
  check: 'M5 12.5 L10 17.5 L19 7',
  'chevron-down': 'M6 9 L12 15 L18 9',
  'arrow-right': 'M5 12 L19 12 M13 6 L19 12 L13 18',
  send: 'M5 12 L19 12 M13 6 L19 12 L13 18',
  alert: 'M12 3 A9 9 0 1 1 11.99 3 Z M12 7.5 L12 13 M12 16.4 L12 16.6',
  play: 'M8 5 L19 12 L8 19 Z',
  pause: 'M9 6 L9 18 M15 6 L15 18',
  swap: 'M4 8 L17 8 M13 4 L17 8 L13 12 M20 16 L7 16 M11 12 L7 16 L11 20',
  replay: 'M5 12 A7 7 0 1 0 7.5 6.5 M7.5 2.5 L7.5 6.5 L11.5 6.5',
  shield: 'M12 3 L19 6 L19 12 C19 16 16 19 12 21 C8 19 5 16 5 12 L5 6 Z M9 12 L11 14 L15 10',
  flame:
    'M12 3 C13 7 17 9 17 14 A5 5 0 0 1 7 14 C7 11 9 10 10 8 C10.5 10 11.5 11 12 11 C12 8 11.5 5.5 12 3 Z',
  home: 'M4 11 L12 4 L20 11 M6 9.5 L6 20 L18 20 L18 9.5',
  body: 'M12 3 A2 2 0 1 1 11.99 3 Z M5 9 L19 9 M12 9 L12 15 M12 15 L8 21 M12 15 L16 21',
} as const;

export type IconName = keyof typeof paths;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2 }: IconProps) {
  return (
    // Decorative: SVGs are not accessibility elements by default. (Passing
    // accessible={false} leaks an invalid DOM attribute on web.)
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
