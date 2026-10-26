import { createCachedApiEndpoint } from '../../common/cached-client';
import { createApiEndpoint } from '../../common/client';
import { getMapIconLegend } from '../mapping';

jest.mock('../../common/client', () => {
  const get = jest.fn();
  return {
    createApiEndpoint: jest.fn(() => ({ get })),
    __mockGet: get,
  };
});

jest.mock('../../common/cached-client', () => ({
  createCachedApiEndpoint: jest.fn(() => ({ get: jest.fn() })),
}));

jest.mock('@/lib/storage/app', () => ({
  getBaseApiUrl: jest.fn(() => 'https://api.resgrid.dev/api/v4'),
}));

const { __mockGet: mockGet } = jest.requireMock('../../common/client') as { __mockGet: jest.Mock };

// Endpoints are created at module load; capture them before beforeEach clears the mocks.
const uncachedPaths = (createApiEndpoint as jest.Mock).mock.calls.map((c) => c[0]);
const cachedPaths = (createCachedApiEndpoint as jest.Mock).mock.calls.map((c) => c[0]);

const envelope = {
  PageSize: 3,
  Status: 'success',
  Environment: 'dev',
  RequestId: 'req-1',
  Version: 'v4',
  Timestamp: '2026-10-25T12:00:00Z',
  Node: 'node-1',
  Data: {
    StatusStyles: [
      {
        Key: 'available',
        Color: '#28A745',
        Meanings: [0],
        UnitStatuses: ['In Quarters'],
        PersonnelStatuses: ['Standing By'],
        Priorities: [],
        UnitPinIconUrl: 'https://api.resgrid.dev/pin-unit',
        PersonPinIconUrl: 'https://api.resgrid.dev/pin-person',
        CallPinIconUrl: null,
      },
    ],
    PriorityStyles: [],
    Calls: [{ Id: null, Name: 'Calls with no type', StatusSetName: null, IconUrl: null, PinIconUrl: null, ImagePath: 'Call', States: [] }],
    Units: [],
    Personnel: [],
    PoiTypes: [],
  },
};

describe('getMapIconLegend', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('targets Mapping/GetMapIconLegend through the uncached client, so every open sees the department as it is now', () => {
    expect(uncachedPaths).toContain('/Mapping/GetMapIconLegend');
    expect(cachedPaths).not.toContain('/Mapping/GetMapIconLegend');
  });

  it('sends no query parameters and returns the whole v4 envelope', async () => {
    mockGet.mockResolvedValueOnce({ data: envelope });

    const result = await getMapIconLegend();

    expect(result).toBe(envelope);
    expect(result.Data.StatusStyles?.[0].UnitStatuses).toEqual(['In Quarters']);
    expect(result.Data.Calls?.[0].Id).toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(undefined, undefined);
  });

  it('forwards the abort signal', async () => {
    const controller = new AbortController();
    mockGet.mockResolvedValueOnce({ data: envelope });

    await getMapIconLegend(controller.signal);

    expect(mockGet).toHaveBeenCalledWith(undefined, controller.signal);
  });

  it('propagates request failures to the caller', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));

    await expect(getMapIconLegend()).rejects.toThrow('Network Error');
  });
});
