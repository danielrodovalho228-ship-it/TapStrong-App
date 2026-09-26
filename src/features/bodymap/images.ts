/* Generated from assets/bodies (SPEC §5). 7 bands × 2 sexes × 2 views. */
import type { ImageSourcePropType } from 'react-native';

import type { BodyBand } from '../profile/age';

export type BodySex = 'm' | 'f';

/** The neutral body option (SPEC §11.8) stays hidden until its 14 images exist. */
export const NEUTRAL_BODY_AVAILABLE = false;
export type BodyView = 'front' | 'back';

const images: Record<BodyBand, Record<BodySex, Record<BodyView, ImageSourcePropType>>> = {
  kid: {
    m: {
      front: require('@/assets/bodies/body-kid-m-front.webp'),
      back: require('@/assets/bodies/body-kid-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-kid-f-front.webp'),
      back: require('@/assets/bodies/body-kid-f-back.webp'),
    },
  },
  teen: {
    m: {
      front: require('@/assets/bodies/body-teen-m-front.webp'),
      back: require('@/assets/bodies/body-teen-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-teen-f-front.webp'),
      back: require('@/assets/bodies/body-teen-f-back.webp'),
    },
  },
  young: {
    m: {
      front: require('@/assets/bodies/body-young-m-front.webp'),
      back: require('@/assets/bodies/body-young-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-young-f-front.webp'),
      back: require('@/assets/bodies/body-young-f-back.webp'),
    },
  },
  adult: {
    m: {
      front: require('@/assets/bodies/body-adult-m-front.webp'),
      back: require('@/assets/bodies/body-adult-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-adult-f-front.webp'),
      back: require('@/assets/bodies/body-adult-f-back.webp'),
    },
  },
  mid: {
    m: {
      front: require('@/assets/bodies/body-mid-m-front.webp'),
      back: require('@/assets/bodies/body-mid-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-mid-f-front.webp'),
      back: require('@/assets/bodies/body-mid-f-back.webp'),
    },
  },
  senior: {
    m: {
      front: require('@/assets/bodies/body-senior-m-front.webp'),
      back: require('@/assets/bodies/body-senior-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-senior-f-front.webp'),
      back: require('@/assets/bodies/body-senior-f-back.webp'),
    },
  },
  elder: {
    m: {
      front: require('@/assets/bodies/body-elder-m-front.webp'),
      back: require('@/assets/bodies/body-elder-m-back.webp'),
    },
    f: {
      front: require('@/assets/bodies/body-elder-f-front.webp'),
      back: require('@/assets/bodies/body-elder-f-back.webp'),
    },
  },
};

export function bodyImage(band: BodyBand, sex: BodySex, view: BodyView = 'front') {
  return images[band][sex][view];
}
