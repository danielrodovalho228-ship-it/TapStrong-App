import type { TFunction } from 'i18next';

import { kgToLb, type Units } from '../profile/units';

const CM_PER_INCH = 2.54;

/** Body lengths (waist) in the profile's units. */
export function formatLength(t: TFunction, cm: number, units: Units): string {
  return units === 'imperial'
    ? `${(cm / CM_PER_INCH).toFixed(1)} ${t('chat.units.in')}`
    : `${cm.toFixed(1)} ${t('chat.units.cm')}`;
}

export function formatWeight(t: TFunction, kg: number, units: Units): string {
  return units === 'imperial'
    ? `${kgToLb(kg)} ${t('chat.units.lb')}`
    : `${kg.toFixed(1)} ${t('chat.units.kg')}`;
}

export const inchesToCm = (inches: number) => Math.round(inches * CM_PER_INCH * 10) / 10;
