import { getContactFiles } from '@/api/contacts/contactFiles';
import { getContactPreplan } from '@/api/contacts/contactPreplans';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';
import { type ContactPreplanData } from '@/models/v4/contacts/contactPreplanResult';

import { useContactPreplanStore } from '../preplan-store';

jest.mock('@/api/contacts/contactFiles', () => ({ getContactFiles: jest.fn() }));
jest.mock('@/api/contacts/contactPreplans', () => ({ getContactPreplan: jest.fn() }));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockGetPreplan = getContactPreplan as jest.MockedFunction<typeof getContactPreplan>;
const mockGetFiles = getContactFiles as jest.MockedFunction<typeof getContactFiles>;

const preplan = (label: string) => ({ ContactId: 'c1', Label: label }) as unknown as ContactPreplanData;
const file = (name: string) => ({ Id: name, FileName: name }) as unknown as ContactFileResultData;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('useContactPreplanStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useContactPreplanStore.getState().reset();
  });

  it('fetches a pre-plan once per contact unless forced', async () => {
    mockGetPreplan.mockResolvedValue({ Data: preplan('first') } as never);

    await useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchPreplan('c1');
    expect(mockGetPreplan).toHaveBeenCalledTimes(1);

    await useContactPreplanStore.getState().fetchPreplan('c1', true);
    expect(mockGetPreplan).toHaveBeenCalledTimes(2);
  });

  it('drops the cached pre-plan while a forced re-fetch loads, so values revealed under an old grant are not left on screen', async () => {
    mockGetPreplan.mockResolvedValueOnce({ Data: preplan('revealed') } as never).mockReturnValueOnce(new Promise(() => undefined));
    await useContactPreplanStore.getState().fetchPreplan('c1');
    expect(useContactPreplanStore.getState().preplans.c1).toEqual(preplan('revealed'));

    void useContactPreplanStore.getState().fetchPreplan('c1', true);

    const state = useContactPreplanStore.getState();
    expect(Object.prototype.hasOwnProperty.call(state.preplans, 'c1')).toBe(false);
    expect(state.loadingPreplan.c1).toBe(true);
  });

  it('keeps the newest pre-plan when an older answer for the same contact lands after it', async () => {
    const first = deferred<never>();
    mockGetPreplan.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ Data: preplan('new') } as never);

    const firstRequest = useContactPreplanStore.getState().fetchPreplan('c1');
    await useContactPreplanStore.getState().fetchPreplan('c1', true);
    first.resolve({ Data: preplan('old') } as never);
    await firstRequest;

    expect(useContactPreplanStore.getState().preplans.c1).toEqual(preplan('new'));
    expect(useContactPreplanStore.getState().loadingPreplan.c1).toBe(false);
  });

  it('drops the cached files while a forced re-fetch loads, and keeps the newest answer', async () => {
    const first = deferred<never>();
    mockGetFiles.mockResolvedValueOnce({ Data: [file('revealed.pdf')] } as never).mockReturnValueOnce(first.promise).mockResolvedValueOnce({ Data: [file('new.pdf')] } as never);
    await useContactPreplanStore.getState().fetchFiles('c1');

    const staleRequest = useContactPreplanStore.getState().fetchFiles('c1', true);
    expect(Object.prototype.hasOwnProperty.call(useContactPreplanStore.getState().files, 'c1')).toBe(false);

    await useContactPreplanStore.getState().fetchFiles('c1', true);
    first.resolve({ Data: [file('old.pdf')] } as never);
    await staleRequest;

    expect(useContactPreplanStore.getState().files.c1).toEqual([file('new.pdf')]);
  });

  it('ignores answers still in flight after invalidate', async () => {
    const preplanPending = deferred<never>();
    const filesPending = deferred<never>();
    mockGetPreplan.mockReturnValueOnce(preplanPending.promise);
    mockGetFiles.mockReturnValueOnce(filesPending.promise);

    const preplanRequest = useContactPreplanStore.getState().fetchPreplan('c1');
    const filesRequest = useContactPreplanStore.getState().fetchFiles('c1');
    useContactPreplanStore.getState().invalidate('c1');
    preplanPending.resolve({ Data: preplan('late') } as never);
    filesPending.resolve({ Data: [file('late.pdf')] } as never);
    await Promise.all([preplanRequest, filesRequest]);

    const state = useContactPreplanStore.getState();
    expect(Object.prototype.hasOwnProperty.call(state.preplans, 'c1')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state.files, 'c1')).toBe(false);
    expect(state.loadingPreplan.c1).toBe(false);
    expect(state.loadingFiles.c1).toBe(false);
  });

  it('ignores answers still in flight after reset', async () => {
    const preplanPending = deferred<never>();
    const filesPending = deferred<never>();
    mockGetPreplan.mockReturnValueOnce(preplanPending.promise);
    mockGetFiles.mockReturnValueOnce(filesPending.promise);

    const preplanRequest = useContactPreplanStore.getState().fetchPreplan('c1');
    const filesRequest = useContactPreplanStore.getState().fetchFiles('c2');
    useContactPreplanStore.getState().reset();
    preplanPending.resolve({ Data: preplan('late') } as never);
    filesPending.resolve({ Data: [file('late.pdf')] } as never);
    await Promise.all([preplanRequest, filesRequest]);

    const state = useContactPreplanStore.getState();
    expect(state.preplans).toEqual({});
    expect(state.files).toEqual({});
    expect(state.loadingPreplan).toEqual({});
    expect(state.loadingFiles).toEqual({});
  });

  it('records the error and clears loading on failure', async () => {
    mockGetPreplan.mockRejectedValueOnce(new Error('offline'));

    await useContactPreplanStore.getState().fetchPreplan('c1');

    expect(useContactPreplanStore.getState().error).toBe('offline');
    expect(useContactPreplanStore.getState().loadingPreplan.c1).toBe(false);
  });
});
