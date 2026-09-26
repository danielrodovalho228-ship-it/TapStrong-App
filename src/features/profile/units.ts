import { getLocales } from 'expo-localization';

/** Units — SPEC §7: imperial by default in the US. Values are stored metric. */
export type Units = 'imperial' | 'metric';

export function deviceUnits(): Units {
  const system = getLocales()[0]?.measurementSystem;
  if (system === 'us') return 'imperial';
  if (system === 'metric' || system === 'uk') return 'metric';
  const region = getLocales()[0]?.regionCode;
  return region === 'US' || region === null || region === undefined ? 'imperial' : 'metric';
}

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export function feetInchesToCm(feet: number, inches: number): number {
  return round1((feet * 12 + inches) * CM_PER_INCH);
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function lbToKg(lb: number): number {
  return round1(lb * KG_PER_LB);
}

export function kgToLb(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Plausible ranges, matching the database checks on `profiles`. */
export const HEIGHT_CM_RANGE = [50, 250] as const;
export const WEIGHT_KG_RANGE = [15, 350] as const;

export function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
