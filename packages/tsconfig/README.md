# `@vaeloom/tsconfig`

Shared TypeScript compiler configuration presets for Vaeloom monorepo packages
and applications.

## Configurations

- `base.json`: Common strict TypeScript configurations, ES2022 target, `bundler`
  module resolution.
- `nextjs.json`: Next.js application TypeScript settings (JSX preserve,
  plugins).
- `nestjs.json`: Node/NestJS backend TypeScript settings (decorators, metadata,
  `Node16` module resolution with CommonJS output).

## Usage

In package `tsconfig.json`:

```json
{
  "extends": "@vaeloom/tsconfig/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Paths resolve relative to the config file that declares them, so a `baseUrl`
entry is neither needed nor accepted: TypeScript 6 rejects it as a deprecated
option.
