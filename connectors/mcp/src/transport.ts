import { spawn, type ChildProcess } from 'child_process';
import axios from 'axios';
import type { McpConfig, JSONRPCRequest, JSONRPCResponse } from './types';

export interface Transport {
  send(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  close(): Promise<void>;
}

export function createTransport(config: McpConfig): Transport {
  switch (config.transport) {
    case 'stdio':
      return new StdioTransport(config.command!, config.args);
    case 'sse':
      return new SSETransport(config.url!, config.headers);
    default:
      throw new Error(`Unsupported transport: ${config.transport}`);
  }
}

class StdioTransport implements Transport {
  private process: ChildProcess | null = null;
  private buffer = '';
  private pendingResolve: ((value: JSONRPCResponse) => void) | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;
  private requestId = 0;

  constructor(
    private command: string,
    private args?: string[],
  ) {}

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.process) {
      const [cmd, ...restArgs] = process.platform === 'win32'
        ? [process.env.COMSPEC ?? 'cmd.exe', '/c', this.command, ...(this.args ?? [])]
        : [this.command, ...(this.args ?? [])];

      this.process = spawn(cmd, restArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout!.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        this.tryProcessMessages();
      });

      this.process.stderr!.on('data', (chunk: Buffer) => {
        process.stderr.write(chunk);
      });

      this.process.on('exit', (code) => {
        if (this.pendingReject) {
          this.pendingReject(new Error(`Process exited with code ${code}`));
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      });
    }

    const id = ++this.requestId;
    const msg = JSON.stringify({ ...request, id }) + '\n';

    return new Promise<JSONRPCResponse>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.process!.stdin!.write(msg);
    });
  }

  private tryProcessMessages(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line) as JSONRPCResponse;
        if (this.pendingResolve) {
          this.pendingResolve(response);
          this.pendingResolve = null;
          this.pendingReject = null;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.stdin!.end();
      this.process.kill();
      this.process = null;
    }
  }
}

class SSETransport implements Transport {
  private client: ReturnType<typeof axios.create> | null = null;
  private requestId = 0;

  constructor(
    private url: string,
    private headers?: Record<string, string>,
  ) {}

  async send(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    if (!this.client) {
      this.client = axios.create({
        baseURL: this.url,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        timeout: 30000,
      });
    }

    const id = ++this.requestId;
    const response = await this.client.post<JSONRPCResponse>('', {
      ...request,
      id,
    });

    if (response.data.error) {
      throw new Error(
        `MCP error ${response.data.error.code}: ${response.data.error.message}`,
      );
    }

    return response.data;
  }

  async close(): Promise<void> {
    this.client = null;
  }
}
