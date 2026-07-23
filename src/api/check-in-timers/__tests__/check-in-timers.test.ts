jest.mock('@/api/common/client', () => ({
  createApiEndpoint: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

const mockLoggerError = jest.fn();

jest.mock('@/lib/logging', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import { createApiEndpoint } from '@/api/common/client';

import { CallPersonnelCheckInStatusesFetchError, getCallPersonnelCheckInStatuses, performCheckIn, toggleCallTimers } from '../check-in-timers';

interface MockEndpoint {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
}

const mockCreateApiEndpoint = createApiEndpoint as jest.MockedFunction<typeof createApiEndpoint>;

const getEndpoint = (path: string): MockEndpoint => {
  const callIndex = mockCreateApiEndpoint.mock.calls.findIndex(([endpoint]) => endpoint === path);
  return mockCreateApiEndpoint.mock.results[callIndex].value as unknown as MockEndpoint;
};

describe('check-in timer API', () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
    mockCreateApiEndpoint.mock.results.forEach((result) => {
      if (result.type === 'return') {
        const endpoint = result.value as unknown as MockEndpoint;
        endpoint.get.mockReset();
        endpoint.post.mockReset();
        endpoint.put.mockReset();
        endpoint.delete.mockReset();
      }
    });
  });

  it('maps personnel status transport failures to an application error with call context', async () => {
    const endpoint = getEndpoint('/CheckInTimers/GetCallPersonnelCheckInStatuses');
    const transportError = new Error('network unavailable');
    endpoint.get.mockRejectedValue(transportError);

    await expect(getCallPersonnelCheckInStatuses(101)).rejects.toMatchObject({
      name: 'CallPersonnelCheckInStatusesFetchError',
      code: 'CALL_PERSONNEL_CHECK_IN_STATUSES_FETCH_FAILED',
      callId: 101,
      endpointName: 'GetCallPersonnelCheckInStatuses',
      cause: transportError,
    } satisfies Partial<CallPersonnelCheckInStatusesFetchError>);

    expect(mockLoggerError).toHaveBeenCalledWith({
      message: 'Failed to fetch call personnel check-in statuses',
      context: {
        callId: 101,
        endpointName: 'GetCallPersonnelCheckInStatuses',
        endpoint: '/CheckInTimers/GetCallPersonnelCheckInStatuses',
        error: transportError,
      },
    });
  });

  it('passes a managed personnel target user to PerformCheckIn', async () => {
    const endpoint = getEndpoint('/CheckInTimers/PerformCheckIn');
    endpoint.post.mockResolvedValue({ data: { Data: {} } });

    await performCheckIn({
      CallId: 101,
      CheckInType: 0,
      UserId: 'user-9',
      Latitude: '47.61',
      Longitude: '-122.33',
    });

    expect(endpoint.post).toHaveBeenCalledWith({
      CallId: 101,
      CheckInType: 0,
      UserId: 'user-9',
      UnitId: undefined,
      Latitude: '47.61',
      Longitude: '-122.33',
      Note: undefined,
    });
  });

  it('binds primitive toggle parameters through the query string expected by the Core endpoint', async () => {
    const endpoint: MockEndpoint = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    endpoint.put.mockResolvedValue({ data: { Data: {} } });
    mockCreateApiEndpoint.mockReturnValueOnce(endpoint as unknown as ReturnType<typeof createApiEndpoint>);

    await toggleCallTimers(101, true);

    expect(mockCreateApiEndpoint).toHaveBeenLastCalledWith('/CheckInTimers/ToggleCallTimers?callId=101&enabled=true');
    expect(endpoint.put).toHaveBeenCalledWith({});
  });
});
