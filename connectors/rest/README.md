# @vaeloom/connector-rest

Generic REST API connector for Vaeloom.

## Features

- **Auth Strategies**: None, API Key, OAuth2 (client credentials), Basic
- **Pagination**: Offset-based, cursor-based, page-based
- **Rate Limiting**: Token bucket algorithm, respects Retry-After
- **Retry**: Exponential backoff on 5xx errors (max 3)
- **Logging**: Axios request/response interceptors

## Usage

```typescript
import { RestConnector } from '@vaeloom/connector-rest';

const connector = new RestConnector();
await connector.connect({
  baseURL: 'https://api.example.com',
  auth: { type: 'apiKey', apiKey: { key: 'abc123', header: 'X-API-Key' } },
});

const data = await connector.fetch('/users', { page: 1, limit: 10 });
await connector.disconnect();
```
