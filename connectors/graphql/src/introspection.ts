import type { GraphQLSchema, GraphQLType, GraphQLField, GraphQLTypeRef } from './types';

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      name
    }
    enumValues(includeDeprecated: true) {
      name
      description
    }
  }

  fragment InputValue on __InputValue {
    name
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
          }
        }
      }
    }
  }
`;

export { INTROSPECTION_QUERY };

export function parseIntrospectionResult(raw: { __schema: unknown }): GraphQLSchema {
  const schema = raw.__schema as {
    queryType?: { name: string };
    mutationType?: { name: string };
    types: unknown[];
  };

  return {
    queryType: schema.queryType
      ? { name: schema.queryType.name, kind: 'OBJECT' }
      : undefined,
    mutationType: schema.mutationType
      ? { name: schema.mutationType.name, kind: 'OBJECT' }
      : undefined,
    types: (schema.types ?? [])
      .filter((t) => {
        const type = t as { name?: string };
        return type.name && !type.name.startsWith('__');
      })
      .map((t) => parseType(t as Record<string, unknown>)),
  };
}

function parseType(raw: Record<string, unknown>): GraphQLType {
  return {
    name: raw.name as string,
    kind: raw.kind as string,
    description: raw.description as string | undefined,
    fields: raw.fields
      ? (raw.fields as Record<string, unknown>[]).map((f) => ({
          name: f.name as string,
          description: f.description as string | undefined,
          type: parseTypeRef(f.type as Record<string, unknown> | null | undefined),
          args: f.args
            ? (f.args as Record<string, unknown>[]).map((a) => ({
                name: a.name as string,
                type: parseTypeRef(a.type as Record<string, unknown> | null | undefined),
                defaultValue: a.defaultValue as string | undefined,
              }))
            : undefined,
        }))
      : undefined,
    enumValues: raw.enumValues
      ? (raw.enumValues as Record<string, unknown>[]).map((e) => ({
          name: e.name as string,
          description: e.description as string | undefined,
        }))
      : undefined,
    inputFields: raw.inputFields
      ? (raw.inputFields as Record<string, unknown>[]).map((f) => ({
          name: f.name as string,
          type: parseTypeRef(f.type as Record<string, unknown> | null | undefined),
        }))
      : undefined,
    interfaces: raw.interfaces
      ? (raw.interfaces as Record<string, unknown>[]).map((i) => ({
          name: i.name as string,
        }))
      : undefined,
  };
}

function parseTypeRef(
  ref: Record<string, unknown> | null | undefined,
): GraphQLTypeRef {
  if (!ref) {
    return { kind: 'SCALAR' };
  }
  if (ref.ofType) {
    return {
      kind: ref.kind as string,
      name: ref.name as string | undefined,
      ofType: parseTypeRef(ref.ofType as Record<string, unknown> | null | undefined),
    };
  }
  return {
    kind: ref.kind as string,
    name: ref.name as string | undefined,
  };
}
