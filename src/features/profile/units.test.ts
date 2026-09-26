import { cmToFeetInches, feetInchesToCm, inRange, kgToLb, lbToKg, WEIGHT_KG_RANGE } from './units';

describe('units', () => {
  it('converts height both ways', () => {
    expect(feetInchesToCm(5, 10)).toBe(177.8);
    expect(cmToFeetInches(177.8)).toEqual({ feet: 5, inches: 10 });
    expect(cmToFeetInches(182.9)).toEqual({ feet: 6, inches: 0 });
  });

  it('converts weight both ways', () => {
    expect(lbToKg(185)).toBe(83.9);
    expect(kgToLb(83.9)).toBe(185);
  });

  it('checks ranges', () => {
    expect(inRange(80, WEIGHT_KG_RANGE)).toBe(true);
    expect(inRange(5, WEIGHT_KG_RANGE)).toBe(false);
    expect(inRange(NaN, WEIGHT_KG_RANGE)).toBe(false);
  });
});
