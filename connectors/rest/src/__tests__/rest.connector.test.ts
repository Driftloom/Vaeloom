import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RestConnector } from '../rest.connector';

let mock: MockAdapter;
let connector: RestConnector;

beforeEach(() => {
  mock = new MockAdapter(axios);
  connector = new RestConnector();
});

afterEach(async () => {
  mock.restore();
  await connector.disconnect();
});

describe('RestConnector', () => {
  it('should connect and perform GET requests', async () => {
    mock.onGet('/users').reply(200, [{ id: 1, name: 'Alice' }]);

    await connector.connect({ baseURL: 'http://test.com' });
    const result = await connector.fetch<{ id: number }[]>('/users');

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Alice');
  });

  it('should perform POST requests', async () => {
    mock.onPost('/users', { name: 'Bob' }).reply(201, { id: 2, name: 'Bob' });

    await connector.connect({ baseURL: 'http://test.com' });
    const result = await connector.post<{ id: number }>('/users', { name: 'Bob' });

    expect(result.id).toBe(2);
  });

  it('should handle PUT requests', async () => {
    mock.onPut('/users/1', { name: 'Updated' }).reply(200, { id: 1, name: 'Updated' });

    await connector.connect({ baseURL: 'http://test.com' });
    const result = await connector.put<{ name: string }>('/users/1', { name: 'Updated' });

    expect(result.name).toBe('Updated');
  });

  it('should handle DELETE requests', async () => {
    mock.onDelete('/users/1').reply(204);

    await connector.connect({ baseURL: 'http://test.com' });
    await expect(connector.delete('/users/1')).resolves.toBeUndefined();
  });

  it('should test connectivity', async () => {
    mock.onGet('/health').reply(200);

    await connector.connect({ baseURL: 'http://test.com' });
    const healthy = await connector.test();

    expect(healthy).toBe(true);
  });

  it('should sync multiple resources', async () => {
    mock.onGet('/users').reply(200, [{ id: 1 }, { id: 2 }]);
    mock.onGet('/posts').reply(200, [{ id: 1 }]);

    await connector.connect({ baseURL: 'http://test.com' });
    const result = await connector.sync(['/users', '/posts']);

    expect(result.resources['/users']).toBe(2);
    expect(result.resources['/posts']).toBe(1);
    expect(result.success).toBe(true);
  });

  it('should report sync errors', async () => {
    mock.onGet('/fail').networkError();

    await connector.connect({ baseURL: 'http://test.com' });
    const result = await connector.sync(['/fail']);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.resource).toBe('/fail');
  });

  it('should throw when not connected', async () => {
    await expect(connector.fetch('/test')).rejects.toThrow('Not connected');
  });

  it('should apply API key auth header', async () => {
    mock.onGet('/secure').reply((config) => {
      const key = config.headers?.['X-API-Key'];
      return key === 'my-key' ? [200, { ok: true }] : [401, { ok: false }];
    });

    await connector.connect({
      baseURL: 'http://test.com',
      auth: { type: 'apiKey', apiKey: { key: 'my-key', header: 'X-API-Key' } },
    });

    const result = await connector.fetch<{ ok: boolean }>('/secure');
    expect(result.ok).toBe(true);
  });
});
