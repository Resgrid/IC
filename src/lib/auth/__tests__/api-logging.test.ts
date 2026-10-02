/**
 * Sign-in requests never log the password (the axios request body), the whole response, or the username (often an
 * email address).
 */
const mockPost = jest.fn();
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('@/lib/storage/app', () => ({ getBaseApiUrl: () => 'https://api.test/api/v4' }));
jest.mock('@/lib/logging', () => ({ logger: mockLogger }));
jest.mock('@env', () => ({ Env: { IS_MOBILE_APP: 'true' } }));
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ interceptors: { request: { use: jest.fn() } }, post: mockPost })) },
}));

// Required after the mocks exist: the module creates its axios instance at load.
const { loginRequest, ssoExternalTokenRequest } = require('../api') as typeof import('../api');

const USERNAME = 'pat@example.com';
const PASSWORD = 'hunter2-secret';
const requestBody = `grant_type=password&username=${encodeURIComponent(USERNAME)}&password=${PASSWORD}`;
const logged = () => JSON.stringify([mockLogger.info.mock.calls, mockLogger.warn.mock.calls, mockLogger.error.mock.calls]);

describe('sign-in logging', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs a successful sign-in without the username', async () => {
    mockPost.mockResolvedValue({ status: 200, data: { access_token: 'a' }, config: { data: requestBody } });
    await loginRequest({ username: USERNAME, password: PASSWORD });
    expect(logged()).not.toContain(USERNAME);
  });

  it('logs only the status of an unexpected answer, never the response and its request body', async () => {
    mockPost.mockResolvedValue({ status: 204, data: null, config: { data: requestBody } });
    await loginRequest({ username: USERNAME, password: PASSWORD });

    expect(mockLogger.error).toHaveBeenCalledWith({ message: 'Login failed', context: { status: 204 } });
    expect(logged()).not.toContain(PASSWORD);
    expect(logged()).not.toContain(USERNAME);
  });

  it('logs a failed request without the username', async () => {
    const failure = Object.assign(new Error('Network Error'), { isAxiosError: true, config: { data: requestBody } });
    mockPost.mockRejectedValue(failure);

    await expect(loginRequest({ username: USERNAME, password: PASSWORD })).rejects.toBe(failure);

    expect(mockLogger.error).toHaveBeenCalledWith({ message: 'Login failed', context: { error: failure } });
    expect(mockLogger.error.mock.calls[0][0].context).not.toHaveProperty('username');
  });

  it('logs the SSO exchange with the provider, never the username', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { access_token: 'a' } }).mockResolvedValueOnce({ status: 204, data: null });
    await ssoExternalTokenRequest({ provider: 'oidc', externalToken: 'id-token', username: USERNAME });
    await ssoExternalTokenRequest({ provider: 'oidc', externalToken: 'id-token', username: USERNAME });

    mockPost.mockRejectedValueOnce(Object.assign(new Error('boom'), { isAxiosError: true }));
    await expect(ssoExternalTokenRequest({ provider: 'saml2', externalToken: 'relay', username: USERNAME })).rejects.toThrow('boom');

    expect(logged()).not.toContain(USERNAME);
    expect(logged()).not.toContain('id-token');
    expect(mockLogger.error).toHaveBeenCalledWith({ message: 'SSO external token exchange failed', context: { status: 204, provider: 'oidc' } });
  });
});
