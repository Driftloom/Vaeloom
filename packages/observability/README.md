# @vaeloom/observability

Shared observability package for Vaeloom services: Prometheus metrics, OpenTelemetry
tracing, and structured logging helpers — all wired for NestJS (and reusable config
for the Python AI service).

## Modules

### Metrics (`MetricsModule`)

`@Global()` NestJS module that:

- creates a process-wide singleton `prom-client` `Registry`
- provides `MetricsService`
- exposes `GET /metrics` in raw Prometheus text format (NOT behind the `api/v1` prefix)
- registers default metrics:
  - `http_requests_total` (counter, labels: `method`, `route`, `status`)
  - `http_request_duration_seconds` (histogram, labels: `method`, `route`, `status`)
  - `active_connections` (gauge)

```ts
import { MetricsModule, MetricsInterceptor, APP_INTERCEPTOR } from '@vaeloom/observability';

@Module({
  imports: [MetricsModule],
  providers: [{ provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
})
export class AppModule {}
```

`MetricsService` API:

- `recordHttpRequest(method, route, status, durationMs)`
- `incrementActiveConnections(amount?)`
- `decrementActiveConnections(amount?)`
- `incCounter(name, labels?)`
- `observeHistogram(name, value, labels?)`
- `getMetrics(): Promise<string>`

### Tracing (`TracingModule`)

OpenTelemetry via `NodeSDK` with:

- OTLP/HTTP exporter (`OTEL_EXPORTER_OTLP_ENDPOINT`, default `http://localhost:4318`)
- auto-instrumentation: `@opentelemetry/instrumentation-http`,
  `@opentelemetry/instrumentation-nestjs-core`
- `TracingService.startSpan(name, fn)` for manual spans

```ts
import { TracingModule } from '@vaeloom/observability';

TracingModule.forRoot({ serviceName: 'memory-store' });
```

### Logging (`LoggerModule`)

Wraps `nestjs-pino` with the standard Vaeloom redaction/correlation config and exposes
`LoggerService.logStructured(level, message, fields)`. Existing services already wire
pino through their own `ObservabilityModule`; import `LoggerModule` only where you want
this shared default.

```ts
import { LoggerModule } from '@vaeloom/observability';

LoggerModule.forRoot({ serviceName: 'memory-store' });
```

## Python (FastAPI / ai-service)

For FastAPI services, add `prometheus-fastapi-instrumentator` (and OpenTelemetry if
desired) directly to `pyproject.toml` and expose `/metrics` in `main.py`:

```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP trace collector (HTTP) |
| `LOG_LEVEL` | `info` | pino log level |
| `LOG_FORMAT` | `json` | `json` or `pretty` |
| `LOG_SERVICE_NAME` | `vaeloom` | service name on log lines |
