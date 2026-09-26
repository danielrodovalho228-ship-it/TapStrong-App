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
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
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
