import { act, renderHook } from '@testing-library/react-native';

import { GRANT_EXPIRY_MARGIN_MS, useProtectedGrantRefresh } from '@/hooks/use-protected-grant-refresh';
import { dataProtectionStore } from '@/stores/data-protection/store';

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

  it.each([-1, 0])('refreshes immediately for a grant that expires %i ms from mount', (remaining) => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + remaining });
    const refresh = jest.fn();
    const { unmount } = renderHook(() => useProtectedGrantRefresh(refresh));

    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(10 * 60_000);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('refreshes cached data when a panel remounts after its grant expired while unmounted', () => {
    dataProtectionStore.setState({ grantToken: 'grant', stepUpExpiresAt: Date.now() + 60_000 });
    const refresh = jest.fn();
    const mounted = renderHook(() => useProtectedGrantRefresh(refresh));
    mounted.unmount();

    act(() => {
      jest.advanceTimersByTime(60_000 + GRANT_EXPIRY_MARGIN_MS);
    });
    expect(refresh).not.toHaveBeenCalled();

    const remounted = renderHook(() => useProtectedGrantRefresh(refresh));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(dataProtectionStore.getState().grantToken).toBe('grant');
    remounted.unmount();
  });

  it('does not refresh or schedule an expiry without a grant token', () => {
    dataProtectionStore.setState({ grantToken: null, stepUpExpiresAt: Date.now() - 1 });
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
