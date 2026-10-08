import { createCall, updateCall } from '../calls';

jest.mock('../../common/client', () => {
  const post = jest.fn();
  const put = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get: jest.fn(), post, put, delete: jest.fn() })),
    __mockPost: post,
    __mockPut: put,
  };
});

jest.mock('../../common/cached-client', () => ({
  createCachedApiEndpoint: jest.fn(() => ({ get: jest.fn() })),
}));

jest.mock('@/lib/cache/cache-manager', () => ({
  cacheManager: { remove: jest.fn() },
}));

const { __mockPost: mockPost, __mockPut: mockPut } = jest.requireMock('../../common/client') as { __mockPost: jest.Mock; __mockPut: jest.Mock };

const base = { name: 'Structure fire', nature: 'Smoke showing', priority: 1, type: 'Fire' };

describe('createCall / updateCall payloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: {} });
    mockPut.mockResolvedValue({ data: {} });
  });

  it('sends the call identifiers and reporter details', async () => {
    await createCall({ ...base, contactName: 'Jane', contactInfo: '555', externalId: 'CAD-9', incidentId: 'INC-1', referenceId: 'REF-1' });

    expect(mockPost.mock.calls[0][0]).toMatchObject({ ContactName: 'Jane', ContactInfo: '555', ExternalId: 'CAD-9', IncidentId: 'INC-1', ReferenceId: 'REF-1' });
  });

  it('sends blank identifiers when none were entered, which an edit reads as "keep the stored value"', async () => {
    await updateCall({ ...base, callId: '42' });

    expect(mockPut.mock.calls[0][0]).toMatchObject({ Id: '42', ExternalId: '', IncidentId: '', ReferenceId: '' });
  });

  it('sends DispatchOnUtc only when a time is set', async () => {
    await createCall({ ...base, dispatchOnUtc: '2026-10-09T14:30:00.000Z' });
    await createCall({ ...base });
    await updateCall({ ...base, callId: '42', dispatchOnUtc: '2026-10-09T14:30:00.000Z' });
    await updateCall({ ...base, callId: '42', dispatchOnUtc: undefined });

    expect(mockPost.mock.calls[0][0]).toMatchObject({ DispatchOnUtc: '2026-10-09T14:30:00.000Z' });
    expect(mockPost.mock.calls[1][0]).not.toHaveProperty('DispatchOnUtc');
    expect(mockPut.mock.calls[0][0]).toMatchObject({ DispatchOnUtc: '2026-10-09T14:30:00.000Z' });
    expect(mockPut.mock.calls[1][0]).not.toHaveProperty('DispatchOnUtc');
  });

  it('sends a location as "lat,lon" and no location as blank, never a bare ","', async () => {
    await createCall({ ...base, latitude: 39.1, longitude: -119.7 });
    await createCall({ ...base });
    await updateCall({ ...base, callId: '42' });

    expect(mockPost.mock.calls[0][0].Geolocation).toBe('39.1,-119.7');
    expect(mockPost.mock.calls[1][0].Geolocation).toBe('');
    expect(mockPut.mock.calls[0][0].Geolocation).toBe('');
  });

  it('never sends the pickers this app does not have', async () => {
    await createCall({ ...base });
    await updateCall({ ...base, callId: '42' });

    for (const body of [mockPost.mock.calls[0][0], mockPut.mock.calls[0][0]]) {
      expect(body).not.toHaveProperty('ProtocolIds');
      expect(body).not.toHaveProperty('LinkedCallId');
      expect(body).not.toHaveProperty('IndoorMapZoneId');
    }
  });
});
