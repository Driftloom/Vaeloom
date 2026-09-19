# `@vaeloom/plugin-sdk`

Software Development Kit for building, packaging, and executing Vaeloom community and official plugins.

## Features

- Typed interfaces for plugin manifests, lifecycle hooks, and tool registration.
- Sandboxed execution contracts complying with ADR-002 and security boundaries.
- Runtime isolation protocols for plugin workers.

## Usage

```typescript
import { definePlugin, PluginContext } from '@vaeloom/plugin-sdk';

export default definePlugin({
  id: 'my-custom-plugin',
  version: '1.0.0',
  async execute(ctx: PluginContext) {
    // Plugin logic
  }
});
```

See [`plugins/SDK.md`](../../plugins/SDK.md) for full developer documentation.
