import { _getSessionCleanupHandler, registerSessionCleanupHandler, runSessionCleanup } from '../session-cleanup';

describe('session-cleanup registry', () => {
  it('runs the registered handler and propagates its failure to the caller', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    registerSessionCleanupHandler(handler);

    await runSessionCleanup();

    expect(_getSessionCleanupHandler()).toBe(handler);
    expect(handler).toHaveBeenCalledTimes(1);

    handler.mockRejectedValueOnce(new Error('reset failed'));
    await expect(runSessionCleanup()).rejects.toThrow('reset failed');
  });

  it('replaces an earlier registration', async () => {
    const first = jest.fn().mockResolvedValue(undefined);
    const second = jest.fn().mockResolvedValue(undefined);
    registerSessionCleanupHandler(first);
    registerSessionCleanupHandler(second);

    await runSessionCleanup();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
