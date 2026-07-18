# @vaeloom/connector-graphql

GraphQL API connector for Vaeloom with schema introspection and query builder.

## Features

- Execute GraphQL queries and mutations
- Full schema introspection via `__schema`
- Programmatic query construction from field arrays
- Auth header support

## Usage

```typescript
import { GraphQLConnector } from '@vaeloom/connector-graphql';

const connector = new GraphQLConnector();
await connector.connect({
  endpoint: 'https://api.example.com/graphql',
  headers: { Authorization: 'Bearer token' },
});

const data = await connector.query<{ user: { name: string } }>(
  `query GetUser($id: ID!) { user(id: $id) { name } }`,
  { id: '1' },
);

const schema = await connector.introspect();
await connector.disconnect();
```
