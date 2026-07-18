# Health Checks

## Standard Health Endpoint

All services expose `GET /health` returning:

```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "memory": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up", "latencyMs": 5 },
    "redis": { "status": "up", "latencyMs": 2 }
  }
}
```

## Health Check Types

| Type | Endpoint | Interval | Purpose |
|---|---|---|---|
| Liveness | `GET /health` | 10s | Is the service running? |
| Readiness | `GET /health/ready` | 5s | Can the service accept traffic? |
| Startup | `GET /health/startup` | 2s | Has the service initialized? |
| Deep | `GET /health/deep` | 30s | Are all dependencies healthy? |
