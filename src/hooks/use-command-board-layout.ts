import { useWindowDimensions } from 'react-native';

import { isDesktop, isWeb } from '@/lib/platform';

/** Shortest screen edge at or above which a device counts as a tablet rather than a phone. */
const TABLET_SHORTEST_SIDE = 600;

/** Width a landscape phone needs before its controls get the roomy treatment. */
const LANDSCAPE_ROOMY_WIDTH = 700;

/** Browser/Electron window width at or above which we treat the surface as desktop-sized. */
const DESKTOP_ROOMY_WIDTH = 900;

export interface CommandBoardLayout {
  /**
   * True when the surface has room to spare — a tablet in either orientation, a wide landscape
   * phone, or a desktop-sized browser/Electron window. Controls get full-size hit targets here;
   * a phone in portrait stays compact so the header doesn't eat the board.
   */
  isRoomy: boolean;

  /** True when the structure board should render as side-by-side lanes rather than a stacked list. */
  isLandscapeBoard: boolean;

  isLandscape: boolean;
  width: number;
  height: number;
}

/**
 * Layout decisions shared by the command board and its sections.
 *
 * Deliberately size-driven rather than platform-driven: a phone in landscape, a tablet, and a
 * narrow browser window are all just widths, and an IC running the board on a tablet in a truck
 * needs the same big targets as one on a desktop.
 */
export const useCommandBoardLayout = (): CommandBoardLayout => {
  const { width, height } = useWindowDimensions();

  const shortestSide = Math.min(width, height);
  const isLandscape = width > height;

  const isRoomy = shortestSide >= TABLET_SHORTEST_SIDE || (isLandscape && width >= LANDSCAPE_ROOMY_WIDTH) || ((isWeb || isDesktop) && width >= DESKTOP_ROOMY_WIDTH);

  return {
    isRoomy,
    isLandscapeBoard: isLandscape && shortestSide >= TABLET_SHORTEST_SIDE,
    isLandscape,
    width,
    height,
  };
};
