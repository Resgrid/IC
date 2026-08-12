/**
 * incidentChannelsByCallId holds undefined both before the fetch lands and for an incident that
 * genuinely has no channels, so callers (the command board's chat actions) need a separate in-flight
 * marker to avoid telling the user chat is unavailable while it is still loading.
 */
const mockGetChannels = jest.fn();

jest.mock('@/services/signalr.service', () => ({
  signalRService: { invoke: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/env', () => ({
  Env: { CHAT_HUB_NAME: 'chatHub' },
}));

jest.mock('@/lib/logging', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), trace: jest.fn(), fatal: jest.fn() },
}));

jest.mock('@/lib/i18n/utils', () => ({ translate: (key: string) => key }));

jest.mock('@/lib/storage', () => ({ zustandStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() } }));

jest.mock('@/api/chat/chat', () => ({
  getChannels: (...args: unknown[]) => mockGetChannels(...args),
  getMessages: jest.fn().mockResolvedValue({ Data: [] }),
  getMembers: jest.fn().mockResolvedValue({ Data: [] }),
  getMyPendingAcks: jest.fn().mockResolvedValue({ Data: [] }),
  markRead: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/api/chat/chatbot', () => ({
  getChatbotChannel: jest.fn(),
  sendChatbotMessage: jest.fn(),
  newChatbotSession: jest.fn(),
}));

jest.mock('@/stores/auth/store', () => ({
  __esModule: true,
  default: { getState: () => ({ userId: 'user-1', profile: { name: 'Test User' } }) },
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: { getState: () => ({ showToast: jest.fn() }) },
}));

// Loaded lazily so the mock factories above run after their `mock*` consts exist.
type ChatStoreApi = typeof import('../store').useChatStore;
let useChatStore: ChatStoreApi;

beforeAll(() => {
  useChatStore = require('../store').useChatStore as ChatStoreApi;
});

describe('loadIncidentChannels status', () => {
  beforeEach(() => {
    mockGetChannels.mockReset();
    useChatStore.setState({ incidentChannelsByCallId: {}, incidentChannelsStatusByCallId: {} });
  });

  it('marks the incident as loading until the request resolves', async () => {
    let resolveChannels: (value: { Data: unknown[] }) => void = () => undefined;
    mockGetChannels.mockReturnValue(
      new Promise((resolve) => {
        resolveChannels = resolve as (value: { Data: unknown[] }) => void;
      })
    );

    const pending = useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loading');
    // The map is still empty mid-flight — the status is the only way to tell that apart from "none".
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toBeUndefined();

    resolveChannels({ Data: [{ ChatChannelId: 'c-1', CallId: 42 }] });
    await pending;

    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loaded');
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toHaveLength(1);
  });

  it('records an empty result as loaded so callers can report chat unavailable', async () => {
    // The incident has no channels of its own: the request succeeded, the filter matched nothing.
    mockGetChannels.mockResolvedValue({ Data: [{ ChatChannelId: 'c-9', CallId: 99 }] });

    await useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loaded');
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toEqual([]);
  });

  it('marks the incident failed — not loaded — when the request throws', async () => {
    mockGetChannels.mockRejectedValue(new Error('network down'));

    await useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('failed');
    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).not.toBe('loaded');
    // Nothing was written, so an empty map here must not read as "this incident has no chat".
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toBeUndefined();
  });

  it('recovers to loaded when a retry succeeds after a failure', async () => {
    mockGetChannels.mockRejectedValueOnce(new Error('network down'));
    await useChatStore.getState().loadIncidentChannels('42');
    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('failed');

    mockGetChannels.mockResolvedValue({ Data: [{ ChatChannelId: 'c-1', CallId: 42 }] });
    await useChatStore.getState().loadIncidentChannels('42');

    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loaded');
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toHaveLength(1);
  });

  it('runs one request per incident while a fetch is already open', async () => {
    let resolveChannels: (value: { Data: unknown[] }) => void = () => undefined;
    mockGetChannels.mockReturnValue(
      new Promise((resolve) => {
        resolveChannels = resolve as (value: { Data: unknown[] }) => void;
      })
    );

    // The board's load effect and a retry tap both firing while the first fetch is open.
    const first = useChatStore.getState().loadIncidentChannels('42');
    const second = useChatStore.getState().loadIncidentChannels('42');

    // The second call is a no-op that resolves immediately; the first is still in flight.
    await second;
    expect(mockGetChannels).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loading');

    resolveChannels({ Data: [{ ChatChannelId: 'c-1', CallId: 42 }] });
    await first;

    expect(mockGetChannels).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loaded');
    expect(useChatStore.getState().incidentChannelsByCallId['42']).toHaveLength(1);
  });

  it('lets a different incident load while one is in flight', async () => {
    const resolvers: ((value: { Data: unknown[] }) => void)[] = [];
    mockGetChannels.mockImplementation(() => new Promise((resolve) => resolvers.push(resolve as (value: { Data: unknown[] }) => void)));

    const first = useChatStore.getState().loadIncidentChannels('42');
    const second = useChatStore.getState().loadIncidentChannels('43');

    // The guard is per call id — a second incident must not be blocked by the first.
    expect(mockGetChannels).toHaveBeenCalledTimes(2);
    expect(useChatStore.getState().incidentChannelsStatusByCallId['43']).toBe('loading');

    resolvers.forEach((resolve) => resolve({ Data: [] }));
    await Promise.all([first, second]);
  });

  it('allows a fresh request once the previous one settled', async () => {
    mockGetChannels.mockResolvedValue({ Data: [{ ChatChannelId: 'c-1', CallId: 42 }] });

    await useChatStore.getState().loadIncidentChannels('42');
    await useChatStore.getState().loadIncidentChannels('42');

    expect(mockGetChannels).toHaveBeenCalledTimes(2);
    expect(useChatStore.getState().incidentChannelsStatusByCallId['42']).toBe('loaded');
  });

  it('does not set a status for an unparseable call id', async () => {
    await useChatStore.getState().loadIncidentChannels('not-a-number');

    expect(mockGetChannels).not.toHaveBeenCalled();
    expect(useChatStore.getState().incidentChannelsStatusByCallId['not-a-number']).toBeUndefined();
  });
});
