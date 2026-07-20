import { createApiEndpoint } from '../../common/client';
import { getBundle } from '../sync';

jest.mock('../../common/client');

const mockCreate = createApiEndpoint as jest.MockedFunction<typeof createApiEndpoint>;

describe('command sync api', () => {
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReturnValue({ get, post: jest.fn(), put: jest.fn(), delete: jest.fn() } as unknown as ReturnType<typeof createApiEndpoint>);
  });

  it('getBundle requests /Sync/Bundle with includeAccountability=true by default', async () => {
    const payload = { Data: { Boards: [] } };
    get.mockResolvedValue({ data: payload });

    const result = await getBundle();

    expect(mockCreate).toHaveBeenCalledWith('/Sync/Bundle');
    expect(get).toHaveBeenCalledWith({ includeAccountability: true });
    expect(result).toBe(payload);
  });

  it('getBundle forwards includeAccountability=false', async () => {
    get.mockResolvedValue({ data: { Data: null } });

    await getBundle(false);

    expect(get).toHaveBeenCalledWith({ includeAccountability: false });
  });
});
