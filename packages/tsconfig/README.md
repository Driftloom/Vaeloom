# `@vaeloom/tsconfig`

Shared TypeScript compiler configuration presets for Vaeloom monorepo packages and applications.

## Configurations

- `base.json`: Common strict TypeScript configurations, ES2022 target, module resolution node.
- `nextjs.json`: Next.js application TypeScript settings (JSX preserve, plugins).
- `nestjs.json`: Node/NestJS backend TypeScript settings (decorators, metadata).

## Usage

In package `tsconfig.json`:

```json
{
  "extends": "@vaeloom/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```
