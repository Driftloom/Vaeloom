export interface GraphQLConfig {
  endpoint: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: GraphQLError[];
}

export interface GraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface GraphQLSchema {
  queryType?: GraphQLType;
  mutationType?: GraphQLType;
  types: GraphQLType[];
}

export interface GraphQLType {
  name: string;
  kind: string;
  description?: string;
  fields?: GraphQLField[];
  enumValues?: { name: string; description?: string }[];
  inputFields?: GraphQLField[];
  interfaces?: { name: string }[];
}

export interface GraphQLField {
  name: string;
  description?: string;
  type: GraphQLTypeRef;
  args?: GraphQLArg[];
}

export interface GraphQLTypeRef {
  kind: string;
  name?: string;
  ofType?: GraphQLTypeRef | null;
}

export interface GraphQLArg {
  name: string;
  type: GraphQLTypeRef;
  defaultValue?: string;
}
