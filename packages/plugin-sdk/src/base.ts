import type { PluginManifest, PluginContext, PluginLifecycle, PluginConfig, PluginAPI, PluginLogger } from './types';

export abstract class PluginBase implements PluginLifecycle {
  public abstract manifest: PluginManifest;

  protected ctx!: PluginContext;
  protected config!: PluginConfig;
  protected api!: PluginAPI;
  protected logger!: PluginLogger;

  async onInit(ctx: PluginContext): Promise<void> {
    this.ctx = ctx;
    this.config = ctx.config;
    this.api = ctx.api;
    this.logger = ctx.logger;
  }

  async onActivate(_ctx: PluginContext): Promise<void> {}
  async onDeactivate(_ctx: PluginContext): Promise<void> {}
  async onUninstall(_ctx: PluginContext): Promise<void> {}
}
