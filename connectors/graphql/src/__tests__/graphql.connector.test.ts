import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { GraphQLConnector } from '../graphql.connector';

let mock: MockAdapter;
let connector: GraphQLConnector;

beforeEach(() => {
  mock = new MockAdapter(axios);
  connector = new GraphQLConnector();
});

afterEach(async () => {
  mock.restore();
  await connector.disconnect();
});

describe('GraphQLConnector', () => {
  it('should execute a query and return data', async () => {
    mock.onPost('').reply(200, {
      data: { user: { name: 'Alice' } },
    });

    await connector.connect({ endpoint: 'http://test.com/graphql' });
    const result = await connector.query<{ user: { name: string } }>(
      'query { user { name } }',
    );

    expect(result.user.name).toBe('Alice');
  });

  it('should throw on GraphQL errors', async () => {
    mock.onPost('').reply(200, {
      data: null,
      errors: [{ message: 'Field "user" not found' }],
    });

    await connector.connect({ endpoint: 'http://test.com/graphql' });
    await expect(connector.query('query { user { name } }')).rejects.toThrow(
      'GraphQL errors: Field "user" not found',
    );
  });

  it('should execute mutations', async () => {
    mock.onPost('').reply(200, {
      data: { createUser: { id: '1' } },
    });

    await connector.connect({ endpoint: 'http://test.com/graphql' });
    const result = await connector.mutate<{ createUser: { id: string } }>(
      'mutation { createUser(name: "Bob") { id } }',
    );

    expect(result.createUser.id).toBe('1');
  });

  it('should perform introspection', async () => {
    mock.onPost('').reply(200, {
      data: {
        __schema: {
          queryType: { name: 'Query' },
          mutationType: { name: 'Mutation' },
          types: [
            {
              kind: 'OBJECT',
              name: 'Query',
              fields: [
                {
                  name: 'user',
                  type: { kind: 'OBJECT', name: 'User', ofType: null },
                },
              ],
            },
            {
              kind: 'OBJECT',
              name: 'User',
              fields: [
                {
                  name: 'id',
                  type: { kind: 'SCALAR', name: 'ID', ofType: null },
                },
                {
                  name: 'name',
                  type: { kind: 'SCALAR', name: 'String', ofType: null },
                },
              ],
            },
          ],
        },
      },
    });

    await connector.connect({ endpoint: 'http://test.com/graphql' });
    const schema = await connector.introspect();

    expect(schema.queryType?.name).toBe('Query');
    expect(schema.mutationType?.name).toBe('Mutation');
    expect(schema.types).toHaveLength(2);
  });

  it('should build queries from fields', () => {
    expect(connector.buildQuery(['id', 'name'])).toContain('id');
    expect(connector.buildQuery(['id', 'name'])).toContain('name');
  });

  it('should throw when not connected', async () => {
    await expect(connector.query('query { x }')).rejects.toThrow('Not connected');
  });
});
