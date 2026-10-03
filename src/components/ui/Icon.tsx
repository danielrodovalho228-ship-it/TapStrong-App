import Svg, { Path } from 'react-native-svg';

import { useColors } from '@/theme';

/** Minimal line-icon set, drawn in-house to avoid a generic icon-font look. */
const paths = {
  'chevron-left': 'M15 5 L8 12 L15 19',
  'chevron-right': 'M9 5 L16 12 L9 19',
  close: 'M6 6 L18 18 M18 6 L6 18',
  plus: 'M12 5 L12 19 M5 12 L19 12',
  minus: 'M5 12 L19 12',
  check: 'M5 12.5 L10 17.5 L19 7',
  'chevron-down': 'M6 9 L12 15 L18 9',
  'chevron-up': 'M6 15 L12 9 L18 15',
  'arrow-right': 'M5 12 L19 12 M13 6 L19 12 L13 18',
  send: 'M5 12 L19 12 M13 6 L19 12 L13 18',
  alert: 'M12 3 A9 9 0 1 1 11.99 3 Z M12 7.5 L12 13 M12 16.4 L12 16.6',
  play: 'M8 5 L19 12 L8 19 Z',
  pause: 'M9 6 L9 18 M15 6 L15 18',
  swap: 'M4 8 L17 8 M13 4 L17 8 L13 12 M20 16 L7 16 M11 12 L7 16 L11 20',
  clock: 'M12 3 A9 9 0 1 1 11.99 3 Z M12 7 L12 12 L15.5 14',
  more: 'M5 12 L5.01 12 M12 12 L12.01 12 M19 12 L19.01 12',
  rotate:
    'M4 12 A8 8 0 0 1 18 6.7 M18 2.5 L18 6.7 L13.8 6.7 M20 12 A8 8 0 0 1 6 17.3 M6 21.5 L6 17.3 L10.2 17.3',
  bandage:
    'M4.5 14.5 L14.5 4.5 A3.5 3.5 0 0 1 19.5 9.5 L9.5 19.5 A3.5 3.5 0 0 1 4.5 14.5 Z M10 10 L10.01 10 M14 14 L14.01 14 M12 12 L12.01 12',
  help: 'M12 3 A9 9 0 1 1 11.99 3 Z M9.6 9.4 A2.5 2.5 0 1 1 13.2 11.7 C12.4 12.1 12 12.6 12 13.6 M12 16.6 L12 16.8',
  replay: 'M5 12 A7 7 0 1 0 7.5 6.5 M7.5 2.5 L7.5 6.5 L11.5 6.5',
  shield: 'M12 3 L19 6 L19 12 C19 16 16 19 12 21 C8 19 5 16 5 12 L5 6 Z M9 12 L11 14 L15 10',
  flame:
    'M12 3 C13 7 17 9 17 14 A5 5 0 0 1 7 14 C7 11 9 10 10 8 C10.5 10 11.5 11 12 11 C12 8 11.5 5.5 12 3 Z',
  home: 'M4 11 L12 4 L20 11 M6 9.5 L6 20 L18 20 L18 9.5',
  body: 'M12 3 A2 2 0 1 1 11.99 3 Z M5 9 L19 9 M12 9 L12 15 M12 15 L8 21 M12 15 L16 21',
  progress: 'M4 20 L20 20 M6 20 L6 13 M10 20 L10 9 M14 20 L14 12 M18 20 L18 6',
  speaker:
    'M4 9.5 L8 9.5 L13 5 L13 19 L8 14.5 L4 14.5 Z M16 9 C17.5 10.5 17.5 13.5 16 15 M18.5 6.5 C21.5 9.5 21.5 14.5 18.5 17.5',
  library:
    'M4 4 L10 4 L10 10 L4 10 Z M14 4 L20 4 L20 10 L14 10 Z M4 14 L10 14 L10 20 L4 20 Z M14 14 L20 14 L20 20 L14 20 Z',
  star: 'M12 3.5 L14.6 9 L20.5 9.6 L16 13.6 L17.3 19.5 L12 16.5 L6.7 19.5 L8 13.6 L3.5 9.6 L9.4 9 Z',
  dumbbell: 'M3 10 L3 14 M6 7.5 L6 16.5 M18 7.5 L18 16.5 M21 10 L21 14 M6 12 L18 12',
  settings:
    'M12 9 A3 3 0 1 1 11.99 9 Z M12 2.5 L12 5 M12 19 L12 21.5 M2.5 12 L5 12 M19 12 L21.5 12 M5.3 5.3 L7.1 7.1 M16.9 16.9 L18.7 18.7 M5.3 18.7 L7.1 16.9 M16.9 7.1 L18.7 5.3',
  calendar: 'M4 6 L20 6 L20 20 L4 20 Z M4 10 L20 10 M8 3.5 L8 7.5 M16 3.5 L16 7.5',
  filter: 'M4 6 L20 6 M7 12 L17 12 M10 18 L14 18',
  edit: 'M4 20 L8 19 L19 8 L16 5 L5 16 Z M14 7 L17 10',
  share: 'M12 15 L12 3 M7.5 7.5 L12 3 L16.5 7.5 M5 12 L5 20 L19 20 L19 12',
  info: 'M12 3 A9 9 0 1 1 11.99 3 Z M12 11 L12 16.5 M12 7.6 L12 7.8',
  search: 'M10.5 4 A6.5 6.5 0 1 1 10.49 4 Z M15.5 15.5 L20 20',
  list: 'M8 6 L20 6 M8 12 L20 12 M8 18 L20 18 M4 6 L4.01 6 M4 12 L4.01 12 M4 18 L4.01 18',
  note: 'M5 4 L19 4 L19 20 L5 20 Z M8 9 L16 9 M8 13 L16 13 M8 17 L12 17',
  family:
    'M9 7 A3 3 0 1 1 8.99 7 Z M3.5 20 C3.5 15.5 14.5 15.5 14.5 20 M17 9 A2.2 2.2 0 1 1 16.99 9 Z M15.5 14 C18.5 13.5 21 15.5 21 19',
} as const;

export type IconName = keyof typeof paths;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color: colorProp, strokeWidth = 2 }: IconProps) {
  const ink = useColors().ink;
  const color = colorProp ?? ink;
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
