const mockStore = new Map<string, unknown>();

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn((key: string) => (mockStore.has(key) ? mockStore.get(key) : null)),
  setItem: jest.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
  removeItem: jest.fn((key: string) => {
    mockStore.delete(key);
  }),
}));

jest.mock('@env', () => ({
  Env: {
    BASE_API_URL: 'https://api.resgrid.test',
    API_VERSION: 'v4',
  },
}));

import { BASE_API_URL_STORAGE_KEY, getBaseApiUrl, removeBaseApiUrl, setBaseApiUrl } from '../app';

describe('base API url storage', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('stores the url under the exported key', async () => {
    await setBaseApiUrl('https://api.resgrid.eu/api/v4');

    expect(mockStore.get(BASE_API_URL_STORAGE_KEY)).toBe('https://api.resgrid.eu/api/v4');
  });

  it('returns the stored url', async () => {
    await setBaseApiUrl('https://api.resgrid.eu/api/v4');

    expect(getBaseApiUrl()).toBe('https://api.resgrid.eu/api/v4');
  });

  it('trims whitespace and trailing slashes when storing', async () => {
    await setBaseApiUrl('  https://example.org/api/v4//  ');

    expect(getBaseApiUrl()).toBe('https://example.org/api/v4');
  });

  it('falls back to the environment default when nothing is stored', () => {
    expect(getBaseApiUrl()).toBe('https://api.resgrid.test/api/v4');
  });

  it('falls back to the environment default after removal', async () => {
    await setBaseApiUrl('https://api.resgrid.eu/api/v4');
    await removeBaseApiUrl();

    expect(getBaseApiUrl()).toBe('https://api.resgrid.test/api/v4');
  });
});
