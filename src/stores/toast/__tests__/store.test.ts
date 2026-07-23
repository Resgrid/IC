import { useToastStore } from '@/stores/toast/store';

describe('useToastStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    useToastStore.getState().toasts.forEach((toast) => {
      useToastStore.getState().removeToast(toast.id);
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('cancels auto-dismiss when a toast is manually removed', () => {
    const listener = jest.fn();
    const unsubscribe = useToastStore.subscribe(listener);
    const id = useToastStore.getState().showToast('info', 'Test message', undefined, { duration: 3000 });

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(3000);

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('automatically removes a toast after its duration', () => {
    useToastStore.getState().showToast('success', 'Saved', undefined, { duration: 1000 });

    expect(useToastStore.getState().toasts).toHaveLength(1);

    jest.advanceTimersByTime(1000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
