import { fontSizeFor, SENIOR_TYPE_BOOST, sizes, textVariants, typeSteps } from './tokens';

describe('type scale', () => {
  it('never renders text below 13 px (SPEC §11.9)', () => {
    for (const variant of Object.keys(textVariants) as (keyof typeof textVariants)[]) {
      expect(fontSizeFor(variant)).toBeGreaterThanOrEqual(13);
    }
  });

  it('senior mode is two steps larger', () => {
    expect(fontSizeFor('body', SENIOR_TYPE_BOOST)).toBe(typeSteps[textVariants.body.step + 2]);
    expect(fontSizeFor('caption', SENIOR_TYPE_BOOST)).toBeGreaterThan(fontSizeFor('caption'));
  });

  it('clamps at the top of the scale', () => {
    expect(fontSizeFor('display', 99)).toBe(typeSteps[typeSteps.length - 1]);
  });

  it('keeps touch targets at 44 and primary button at 54', () => {
    expect(sizes.touchTarget).toBe(44);
    expect(sizes.primaryButtonHeight).toBe(54);
  });
});
