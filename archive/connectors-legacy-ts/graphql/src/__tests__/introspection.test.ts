import { parseIntrospectionResult } from '../introspection';

describe('parseIntrospectionResult', () => {
  it('should parse introspection result into schema', () => {
    const raw = {
      __schema: {
        queryType: { name: 'Query' },
        mutationType: null,
        types: [
          {
            kind: 'OBJECT',
            name: 'Query',
            fields: [
              {
                name: 'hello',
                description: 'A greeting',
                type: { kind: 'SCALAR', name: 'String', ofType: null },
              },
            ],
          },
          {
            kind: 'OBJECT',
            name: '__Type',
            fields: [],
          },
        ],
      },
    };

    const schema = parseIntrospectionResult(raw);

    expect(schema.queryType?.name).toBe('Query');
    expect(schema.mutationType).toBeUndefined();
    expect(schema.types).toHaveLength(1);
    expect(schema.types[0]!.fields).toHaveLength(1);
    expect(schema.types[0]!.fields![0]!.name).toBe('hello');
  });

  it('should filter out __ prefixed types', () => {
    const raw = {
      __schema: {
        types: [
          { kind: 'OBJECT', name: 'User', fields: [] },
          { kind: 'OBJECT', name: '__Type', fields: [] },
          { kind: 'OBJECT', name: '__Schema', fields: [] },
        ],
      },
    };

    const schema = parseIntrospectionResult(raw);
    expect(schema.types).toHaveLength(1);
    expect(schema.types[0]!.name).toBe('User');
  });
});
