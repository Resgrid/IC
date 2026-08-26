const mockStorage = {
  contains: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../index', () => ({
  get storage() {
    return mockStorage;
  },
}));

jest.mock('../../logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../../logging';
import { removeLegacyStorageKeys } from '../legacy-keys';

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('removeLegacyStorageKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.contains.mockReturnValue(false);
  });

  it('deletes the background geolocation key left behind by upgraded installs', () => {
    mockStorage.contains.mockImplementation((key: string) => key === 'BACKGROUND_GEOLOCATION_ENABLED');

    removeLegacyStorageKeys();

    expect(mockStorage.delete).toHaveBeenCalledWith('BACKGROUND_GEOLOCATION_ENABLED');
    expect(mockLogger.info).toHaveBeenCalledWith({
      message: 'Removed legacy storage written by features that no longer exist',
      context: { removed: ['BACKGROUND_GEOLOCATION_ENABLED'] },
    });
  });

  it('is a no-op on a fresh install', () => {
    removeLegacyStorageKeys();

    expect(mockStorage.delete).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('is idempotent across startups', () => {
    let present = true;
    mockStorage.contains.mockImplementation((key: string) => present && key === 'BACKGROUND_GEOLOCATION_ENABLED');
    mockStorage.delete.mockImplementation(() => {
      present = false;
    });

    removeLegacyStorageKeys();
    removeLegacyStorageKeys();

    expect(mockStorage.delete).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows storage failures so startup is never blocked', () => {
    const error = new Error('MMKV unavailable');
    mockStorage.contains.mockImplementation(() => {
      throw error;
    });

    expect(() => removeLegacyStorageKeys()).not.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith({
      message: 'Failed to remove legacy storage keys',
      context: { error },
    });
  });
});
