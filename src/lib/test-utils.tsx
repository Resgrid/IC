import '@shopify/flash-list/jestSetup';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { RenderOptions } from '@testing-library/react-native';
import { render, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import React from 'react';

const createAppWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => <BottomSheetModalProvider>{children}</BottomSheetModalProvider>;
};

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const Wrapper = createAppWrapper(); // make sure we have a new wrapper for each render
  return render(ui, { wrapper: Wrapper, ...options });
};

// use this if you want to test user events
export const setup = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
  const Wrapper = createAppWrapper();
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
};

// Intentionally re-export everything from the library and then override its
// `render` with our wrapper-aware version. The explicit named export wins at
// runtime; `import/export` flags the shadowed name, so it is disabled here.
/* eslint-disable-next-line import/export */
export * from '@testing-library/react-native';
/* eslint-disable-next-line import/export */
export { customRender as render };
