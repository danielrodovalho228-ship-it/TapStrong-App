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
