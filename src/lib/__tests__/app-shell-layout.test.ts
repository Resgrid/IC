import { getAppHeaderHeight } from '@/lib/app-shell-layout';

describe('getAppHeaderHeight', () => {
  it('keeps the safe-area inset while using a compact portrait header', () => {
    expect(getAppHeaderHeight(47, false)).toBe(91);
  });

  it('uses a shorter content height in landscape and rejects negative insets', () => {
    expect(getAppHeaderHeight(0, true)).toBe(40);
    expect(getAppHeaderHeight(-10, false)).toBe(44);
  });
});
