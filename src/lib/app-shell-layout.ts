const PORTRAIT_HEADER_CONTENT_HEIGHT = 44;
const LANDSCAPE_HEADER_CONTENT_HEIGHT = 40;

export const getAppHeaderHeight = (topInset: number, isLandscape: boolean): number => {
  const safeTopInset = Math.max(0, topInset);
  return safeTopInset + (isLandscape ? LANDSCAPE_HEADER_CONTENT_HEIGHT : PORTRAIT_HEADER_CONTENT_HEIGHT);
};
