import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getCallSiteInfo } from '@/api/calls/callSiteInfo';
import { type CallSiteInfoData, CallSiteInfoResult } from '@/models/v4/calls/callSiteInfoResult';
import { useSiteInfoStore } from '@/stores/calls/site-info-store';

jest.mock('@/api/calls/callSiteInfo');
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetCallSiteInfo = getCallSiteInfo as jest.MockedFunction<typeof getCallSiteInfo>;

const makeSiteInfo = (callId: string): CallSiteInfoData => ({
  CallId: callId,
  IsProtected: false,
  Contacts: [
    {
      ContactId: 'c1',
      CallContactType: 0,
      ContactType: 1,
      Name: 'Acme Warehouse',
      PhoneNumber: '5551234',
      EntranceGpsCoordinates: null,
      AlertNotes: [],
      Preplan: null,
      Hazards: [],
      Attachments: [],
    },
  ],
});

const makeResult = (data: CallSiteInfoData | null): CallSiteInfoResult => {
  const result = new CallSiteInfoResult();
  result.Data = data;
  return result;
};

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((r, fail) => {
    resolve = r;
    reject = fail;
  });
  return { promise, resolve, reject };
};

describe('useSiteInfoStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSiteInfoStore.getState().reset();
  });

  it('starts empty', () => {
    const state = useSiteInfoStore.getState();
    expect(state.callId).toBeNull();
    expect(state.siteInfo).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetches and stores the site info for a call', async () => {
    mockGetCallSiteInfo.mockResolvedValue(makeResult(makeSiteInfo('42')));

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    const state = useSiteInfoStore.getState();
    expect(mockGetCallSiteInfo).toHaveBeenCalledWith('42');
    expect(state.callId).toBe('42');
    expect(state.siteInfo?.Contacts).toHaveLength(1);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('stores null site info when the server returns no Data', async () => {
    mockGetCallSiteInfo.mockResolvedValue(makeResult(null));

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    expect(useSiteInfoStore.getState().siteInfo).toBeNull();
    expect(useSiteInfoStore.getState().isLoading).toBe(false);
  });

  it('records the error message and clears loading on failure', async () => {
    mockGetCallSiteInfo.mockRejectedValue(new Error('Network Error'));

    await useSiteInfoStore.getState().fetchSiteInfo('42');

    const state = useSiteInfoStore.getState();
    expect(state.error).toBe('Network Error');
    expect(state.siteInfo).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('ignores a stale response after a different call is requested', async () => {
    const first = deferred<CallSiteInfoResult>();
    mockGetCallSiteInfo.mockImplementationOnce(() => first.promise);
    mockGetCallSiteInfo.mockResolvedValueOnce(makeResult(makeSiteInfo('43')));

    const firstFetch = useSiteInfoStore.getState().fetchSiteInfo('42');
    await useSiteInfoStore.getState().fetchSiteInfo('43');

    first.resolve(makeResult(makeSiteInfo('42')));
    await firstFetch;

    const state = useSiteInfoStore.getState();
    expect(state.callId).toBe('43');
    expect(state.siteInfo?.CallId).toBe('43');
  });

  it('ignores a stale error after a different call is requested', async () => {
    const first = deferred<CallSiteInfoResult>();
    mockGetCallSiteInfo.mockImplementationOnce(() => first.promise);
    mockGetCallSiteInfo.mockResolvedValueOnce(makeResult(makeSiteInfo('43')));

    const firstFetch = useSiteInfoStore.getState().fetchSiteInfo('42');
    await useSiteInfoStore.getState().fetchSiteInfo('43');

    first.reject(new Error('late failure'));
    await firstFetch;

    expect(useSiteInfoStore.getState().error).toBeNull();
    expect(useSiteInfoStore.getState().siteInfo?.CallId).toBe('43');
  });

  it('drops the previous site info while a re-fetch loads, so values revealed under an old grant are not left on screen', async () => {
    mockGetCallSiteInfo.mockResolvedValueOnce(makeResult(makeSiteInfo('42')));
    mockGetCallSiteInfo.mockImplementationOnce(() => new Promise(() => undefined));
    await useSiteInfoStore.getState().fetchSiteInfo('42');

    void useSiteInfoStore.getState().fetchSiteInfo('42');

    const state = useSiteInfoStore.getState();
    expect(state.siteInfo).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it('keeps the newest answer when an older one for the same call lands after it', async () => {
    const first = deferred<CallSiteInfoResult>();
    mockGetCallSiteInfo.mockImplementationOnce(() => first.promise);
    mockGetCallSiteInfo.mockResolvedValueOnce(makeResult({ ...makeSiteInfo('42'), IsProtected: true }));

    const firstFetch = useSiteInfoStore.getState().fetchSiteInfo('42');
    await useSiteInfoStore.getState().fetchSiteInfo('42');

    first.resolve(makeResult(makeSiteInfo('42')));
    await firstFetch;

    expect(useSiteInfoStore.getState().siteInfo?.IsProtected).toBe(true);
  });

  it('ignores an answer still in flight after reset', async () => {
    const pending = deferred<CallSiteInfoResult>();
    mockGetCallSiteInfo.mockImplementationOnce(() => pending.promise);

    const request = useSiteInfoStore.getState().fetchSiteInfo('42');
    useSiteInfoStore.getState().reset();
    pending.resolve(makeResult(makeSiteInfo('42')));
    await request;

    expect(useSiteInfoStore.getState().siteInfo).toBeNull();
    expect(useSiteInfoStore.getState().callId).toBeNull();
  });

  it('reset clears everything', async () => {
    mockGetCallSiteInfo.mockResolvedValue(makeResult(makeSiteInfo('42')));
    await useSiteInfoStore.getState().fetchSiteInfo('42');

    useSiteInfoStore.getState().reset();

    const state = useSiteInfoStore.getState();
    expect(state.callId).toBeNull();
    expect(state.siteInfo).toBeNull();
    expect(state.error).toBeNull();
  });
});
