import { createApiEndpoint } from '../../common/client';
import { deleteNode, establishCommand, getCommandBoard, moveResource } from '../board';

jest.mock('../../common/client');

const mockCreate = createApiEndpoint as jest.MockedFunction<typeof createApiEndpoint>;

describe('command board api', () => {
  const get = jest.fn();
  const post = jest.fn();
  const put = jest.fn();
  const del = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReturnValue({ get, post, put, delete: del } as unknown as ReturnType<typeof createApiEndpoint>);
  });

  it('getCommandBoard interpolates the callId into the route and returns the response data', async () => {
    const payload = { Data: { Command: { CallId: 5 } } };
    get.mockResolvedValue({ data: payload });

    const result = await getCommandBoard(5);

    expect(mockCreate).toHaveBeenCalledWith('/IncidentCommand/GetCommandBoard/5');
    expect(get).toHaveBeenCalledTimes(1);
    expect(result).toBe(payload);
  });

  it('establishCommand posts CallId with a null CommandDefinitionId when none is supplied', async () => {
    post.mockResolvedValue({ data: { Data: null } });

    await establishCommand(5);

    expect(mockCreate).toHaveBeenCalledWith('/IncidentCommand/EstablishCommand');
    expect(post).toHaveBeenCalledWith({ CallId: 5, CommandDefinitionId: null });
  });

  it('establishCommand forwards the template id when supplied', async () => {
    post.mockResolvedValue({ data: { Data: null } });

    await establishCommand(5, 9);

    expect(post).toHaveBeenCalledWith({ CallId: 5, CommandDefinitionId: 9 });
  });

  it('deleteNode interpolates the node id into the route and issues a delete', async () => {
    del.mockResolvedValue({ data: { Data: true } });

    await deleteNode('node-1');

    expect(mockCreate).toHaveBeenCalledWith('/IncidentCommand/DeleteNode/node-1');
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('moveResource posts the move input body', async () => {
    post.mockResolvedValue({ data: { Data: null } });

    await moveResource({ resourceAssignmentId: 'ra-1', targetNodeId: 'node-2' });

    expect(mockCreate).toHaveBeenCalledWith('/IncidentCommand/MoveResource');
    expect(post).toHaveBeenCalledWith({ ResourceAssignmentId: 'ra-1', TargetNodeId: 'node-2' });
  });
});
