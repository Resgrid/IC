import { renderHook } from '@testing-library/react-native';

let mockDimensions = { width: 390, height: 844 };
let mockIsWeb = false;
let mockIsDesktop = false;

jest.mock('react-native', () => ({
  useWindowDimensions: () => mockDimensions,
}));

jest.mock('@/lib/platform', () => ({
  get isWeb() {
    return mockIsWeb;
  },
  get isDesktop() {
    return mockIsDesktop;
  },
}));

// eslint-disable-next-line import/first
import { useCommandBoardLayout } from '../use-command-board-layout';

const layoutFor = (width: number, height: number, options?: { web?: boolean; desktop?: boolean }) => {
  mockDimensions = { width, height };
  mockIsWeb = options?.web ?? false;
  mockIsDesktop = options?.desktop ?? false;
  return renderHook(() => useCommandBoardLayout()).result.current;
};

describe('useCommandBoardLayout', () => {
  afterEach(() => {
    mockDimensions = { width: 390, height: 844 };
    mockIsWeb = false;
    mockIsDesktop = false;
  });

  it('keeps a phone in portrait compact', () => {
    const layout = layoutFor(390, 844);

    expect(layout.isRoomy).toBe(false);
    expect(layout.isLandscapeBoard).toBe(false);
    expect(layout.isLandscape).toBe(false);
  });

  it('gives a phone in landscape room once it is wide enough', () => {
    expect(layoutFor(844, 390).isRoomy).toBe(true);
    // A narrow landscape phone still gets the compact controls.
    expect(layoutFor(667, 375).isRoomy).toBe(false);
  });

  it('treats a tablet as roomy in either orientation', () => {
    expect(layoutFor(834, 1194).isRoomy).toBe(true);
    expect(layoutFor(1194, 834).isRoomy).toBe(true);
  });

  it('only uses the side-by-side lane board on a tablet in landscape', () => {
    expect(layoutFor(1194, 834).isLandscapeBoard).toBe(true);
    // Tablet held in portrait stacks the lanes instead.
    expect(layoutFor(834, 1194).isLandscapeBoard).toBe(false);
    // A landscape phone is wide but not a tablet, so it keeps the stacked list.
    expect(layoutFor(844, 390).isLandscapeBoard).toBe(false);
  });

  it('gives a desktop-sized browser window room, but not a narrow one', () => {
    expect(layoutFor(1440, 900, { web: true }).isRoomy).toBe(true);
    expect(layoutFor(1280, 800, { desktop: true }).isRoomy).toBe(true);
    // A phone-width browser window is still a phone-width surface.
    expect(layoutFor(420, 900, { web: true }).isRoomy).toBe(false);
  });
});
