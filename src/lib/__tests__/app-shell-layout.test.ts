import { getAppHeaderHeight, getAppTabBarHeight } from '@/lib/app-shell-layout';

describe('getAppHeaderHeight', () => {
  it('keeps the safe-area inset while using a compact portrait header', () => {
    expect(getAppHeaderHeight(47, false)).toBe(91);
  });

  it('uses a shorter content height in landscape and rejects negative insets', () => {
    expect(getAppHeaderHeight(0, true)).toBe(40);
    expect(getAppHeaderHeight(-10, false)).toBe(44);
  });
});

describe('getAppTabBarHeight', () => {
  it('adds the bottom safe-area inset in portrait', () => {
    expect(getAppTabBarHeight(34, false)).toBe(94);
  });

  it('uses the fixed landscape height, ignoring the inset', () => {
    expect(getAppTabBarHeight(34, true)).toBe(65);
  });

  it('treats a negative inset as zero', () => {
    expect(getAppTabBarHeight(-10, false)).toBe(60);
  });
});
