import { act, renderHook } from '@testing-library/react-native';

import { dataProtectionStore } from '@/stores/data-protection/store';

import { GRANT_EXPIRY_MARGIN_MS, useProtectedGrantRefresh } from '../use-protected-grant-refresh';

jest.mock('@/stores/data-protection/store', () => {
  const { create } = jest.requireActual('zustand');
  return { dataProtectionStore: create(() => ({ grantToken: null, stepUpExpiresAt: null })) };
});

describe('useProtectedGrantRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    dataProtectionStore.setState({ grantToken: null, stepUpExpiresAt: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not refresh on mount: the panel fetches for itself', () => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + 60_000 });
    const refresh = jest.fn();

    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    expect(refresh).not.toHaveBeenCalled();
    unmount();
  });

  it('refreshes when a grant arrives and when it is dropped', () => {
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    act(() => {
      dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + 60_000 });
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      dataProtectionStore.setState({ grantToken: null, stepUpExpiresAt: null });
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('refreshes once the grant expires, after the margin, even though its token is still held', () => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + 60_000 });
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    act(() => {
      jest.advanceTimersByTime(60_000 + GRANT_EXPIRY_MARGIN_MS - 1);
    });
    expect(refresh).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(dataProtectionStore.getState().grantToken).toBe('grant');
    unmount();
  });

  it('schedules nothing for a grant that had already lapsed', () => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() - 1 });
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });

    expect(refresh).not.toHaveBeenCalled();
    unmount();
  });

  it('moves the expiry refresh to a new grant window and cancels it on unmount', () => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + 60_000 });
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    act(() => {
      dataProtectionStore.setState({ grantToken: 'grant-2', stepUpExpiresAt: Date.now() + 120_000 });
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(60_000 + GRANT_EXPIRY_MARGIN_MS);
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
