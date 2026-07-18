import type { PluginBase } from './base';
import type { PluginContext, PluginLifecycle } from './types';

export function createPlugin(
  base: PluginBase,
  hooks: Partial<PluginLifecycle> = {},
): PluginBase & Required<PluginLifecycle> {
  const merged = Object.assign(base, hooks);
  return merged as PluginBase & Required<PluginLifecycle>;
}

export function definePlugin(pluginClass: new () => PluginBase): () => PluginBase {
  return () => new pluginClass();
}

export async function loadPlugin(
  plugin: PluginBase,
  context: PluginContext,
): Promise<void> {
  await plugin.onInit(context);
  if (context.config.enabled) {
    await plugin.onActivate(context);
  }
}
