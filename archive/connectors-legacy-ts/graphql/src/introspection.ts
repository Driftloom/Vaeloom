import type { GraphQLSchema, GraphQLType, GraphQLField, GraphQLTypeRef } from './types';

/** Loose structural type for raw introspection JSON (GraphQL over HTTP responses). */
type IntrospectionRaw = Record<string, unknown> & {
  name?: string;
  kind?: string;
  description?: string | undefined;
  fields?: IntrospectionRaw[];
  type?: IntrospectionRaw | null | undefined;
  args?: IntrospectionRaw[];
  defaultValue?: string;
  enumValues?: IntrospectionRaw[];
  inputFields?: IntrospectionRaw[];
  interfaces?: IntrospectionRaw[];
  ofType?: IntrospectionRaw | null | undefined;
};

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
    queryType: schema.queryType ? { name: schema.queryType.name, kind: 'OBJECT' } : undefined,
    mutationType: schema.mutationType
      ? { name: schema.mutationType.name, kind: 'OBJECT' }
      : undefined,
    types: (schema.types ?? [])
      .filter((t) => {
        const type = t as { name?: string };
        return type.name && !type.name.startsWith('__');
      })
      .map((t) => parseType(t as unknown as IntrospectionRaw)),
  };
}

function parseType(raw: IntrospectionRaw): GraphQLType {
  return {
    name: raw.name as string,
    kind: raw.kind as string,
    description: raw.description as string | undefined,
    fields: raw.fields
      ? raw.fields.map((f) => ({
          name: f.name as string,
          description: f.description as string | undefined,
          type: parseTypeRef(f.type),
          args: f.args
            ? f.args.map((a) => ({
                name: a.name as string,
                type: parseTypeRef(a.type),
                defaultValue: a.defaultValue as string | undefined,
              }))
            : undefined,
        }))
      : undefined,
    enumValues: raw.enumValues
      ? raw.enumValues.map((e) => ({
          name: e.name as string,
          description: e.description as string | undefined,
        }))
      : undefined,
    inputFields: raw.inputFields
      ? raw.inputFields.map((f) => ({
          name: f.name as string,
          type: parseTypeRef(f.type),
        }))
      : undefined,
    interfaces: raw.interfaces
      ? raw.interfaces.map((i) => ({
          name: i.name as string,
        }))
      : undefined,
  };
}

function parseTypeRef(ref: IntrospectionRaw | null | undefined): GraphQLTypeRef {
  if (!ref) {
    return { kind: 'SCALAR' };
  }
  if (ref.ofType) {
    return {
      kind: ref.kind as string,
      name: ref.name as string | undefined,
      ofType: parseTypeRef(ref.ofType),
    };
  }
  return {
    kind: ref.kind as string,
    name: ref.name as string | undefined,
  };
}
