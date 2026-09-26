import axios from 'axios';
import { VaeloomClient } from '../client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VaeloomClient TypeScript SDK', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn(),
        },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
  });

  it('configures authentication headers correctly with API Key', () => {
    const client = new VaeloomClient({
      apiKey: 'vael_test_key_12345678901234567890',
      tenantId: 'tenant-uuid-1',
    });

    const headers = (client as any).buildHeaders();
    expect(headers['X-API-Key']).toBe('vael_test_key_12345678901234567890');
    expect(headers['X-Tenant-Id']).toBe('tenant-uuid-1');
  });

  it('configures Bearer token authorization header when accessToken is provided', () => {
    const client = new VaeloomClient({
      accessToken: 'jwt.token.here',
    });

    const headers = (client as any).buildHeaders();
    expect(headers['Authorization']).toBe('Bearer jwt.token.here');
  });

  it('creates memory and unwraps response envelope correctly', async () => {
    const client = new VaeloomClient({ apiKey: 'vael_test_key' });
    const memoryData = { content: 'Test note', type: 'note' as const };
    const returnedMemory = { id: 'mem-1', content: 'Test note', type: 'note' };

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { data: returnedMemory },
    });

    const result = await client.createMemory(memoryData);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/memories', memoryData);
    expect(result).toEqual(returnedMemory);
  });

  it('searches memories using POST /api/v1/memories/search', async () => {
    const client = new VaeloomClient({ apiKey: 'vael_test_key' });
    const query = { query: 'test query', limit: 10 };
    const searchResponse = { items: [{ id: 'mem-1' }], total: 1 };

    mockAxiosInstance.post.mockResolvedValueOnce({
      data: searchResponse,
    });

    const result = await client.searchMemories(query);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/v1/memories/search', query);
    expect(result).toEqual(searchResponse);
  });

  it('deletes memory using DELETE /api/v1/memories/:id', async () => {
    const client = new VaeloomClient({ apiKey: 'vael_test_key' });
    mockAxiosInstance.delete.mockResolvedValueOnce({ status: 204 });

    await client.deleteMemory('mem-1');
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/v1/memories/mem-1');
  });

  it('lists agents using GET /api/v1/agents', async () => {
    const client = new VaeloomClient({ apiKey: 'vael_test_key' });
    const agentsList = [{ id: 'agent-1', name: 'JobSearchAgent' }];
    mockAxiosInstance.get.mockResolvedValueOnce({
      data: { agents: agentsList },
    });

    const result = await client.listAgents();
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/agents');
    expect(result).toEqual(agentsList);
  });
});
