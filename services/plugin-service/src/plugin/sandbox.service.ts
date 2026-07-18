import { randomUUID } from 'node:crypto';
import { Script, createContext, type Context } from 'node:vm';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SandboxResult {
  status: 'success' | 'error' | 'timeout';
  output: unknown;
  durationMs: number;
  errorMessage?: string;
}

export interface SandboxContext {
  input: Record<string, unknown>;
  tenantId: string;
  pluginId: string;
  permissions: Record<string, unknown>;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  private readonly defaultTimeoutMs: number;

  constructor(config: ConfigService) {
    this.defaultTimeoutMs = config.get<number>('plugin.sandboxTimeoutMs') ?? 5000;
  }

  /**
   * Executes untrusted plugin code in a Node.js `vm` context with a hard
   * timeout. No access to process, fs, network, or require is exposed.
   */
  async run(code: string, ctx: SandboxContext, timeoutMs = this.defaultTimeoutMs): Promise<SandboxResult> {
    const start = Date.now();
    const scriptId = randomUUID();

    const safeConsole = this.buildSafeConsole(ctx.pluginId, scriptId);

    const sandbox: Record<string, unknown> = {
      console: safeConsole,
      input: ctx.input,
      context: {
        pluginId: ctx.pluginId,
        tenantId: ctx.tenantId,
        permissions: ctx.permissions,
      },
    };

    let context: Context;
    try {
      context = createContext(sandbox);
    } catch (err) {
      return {
        status: 'error',
        output: null,
        durationMs: Date.now() - start,
        errorMessage: `Failed to create sandbox context: ${(err as Error).message}`,
      };
    }

    const wrapped = `(async () => {
      const module = { exports: {} };
      const fn = async (input, context) => {
        ${code}
      };
      return await fn(input, context);
    })()`;

    let timer: NodeJS.Timeout | undefined;
    let script: Script;
    try {
      script = new Script(wrapped, { filename: `plugin-${ctx.pluginId}.js` });
    } catch (err) {
      return {
        status: 'error',
        output: null,
        durationMs: Date.now() - start,
        errorMessage: `Syntax error: ${(err as Error).message}`,
      };
    }

    try {
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Execution exceeded ${timeoutMs}ms timeout`));
        }, timeoutMs);
      });

      const runPromise = script.runInContext(context, { timeout: timeoutMs }) as Promise<unknown>;

      const output = await Promise.race([runPromise, timeoutPromise]);
      if (timer) clearTimeout(timer);

      return {
        status: 'success',
        output: this.sanitize(output),
        durationMs: Date.now() - start,
      };
    } catch (err) {
      if (timer) clearTimeout(timer);
      const isTimeout = /timeout/i.test((err as Error).message);
      this.logger.warn(
        { pluginId: ctx.pluginId, err: (err as Error).message },
        'Sandbox execution failed',
      );
      return {
        status: isTimeout ? 'timeout' : 'error',
        output: null,
        durationMs: Date.now() - start,
        errorMessage: (err as Error).message,
      };
    }
  }

  private buildSafeConsole(pluginId: string, scriptId: string): Record<string, (...args: unknown[]) => void> {
    const prefix = `[plugin:${pluginId}:${scriptId}]`;
    const emit = (level: string, args: unknown[]): void => {
      this.logger.log({ plugin: pluginId, level, args }, prefix);
    };
    return {
      log: (...args: unknown[]) => emit('log', args),
      info: (...args: unknown[]) => emit('info', args),
      warn: (...args: unknown[]) => emit('warn', args),
      error: (...args: unknown[]) => emit('error', args),
      debug: (...args: unknown[]) => emit('debug', args),
    };
  }

  private sanitize(value: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(value ?? null));
    } catch {
      return String(value);
    }
  }
}
