import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Structured-logging helpers built on top of the global nestjs-pino `PinoLogger`.
 *
 * Use `logStructured` to attach arbitrary `fields` that should be searchable in
 * the log backend while keeping the human-readable `message` intact:
 *
 *   logger.logStructured('info', 'memory stored', { memoryId, userId });
 */
@Injectable()
export class LoggerService {
  constructor(private readonly pino: PinoLogger) {}

  private toPino(level: LogLevel): (msgOrObj: string | object, msg?: string) => void {
    switch (level) {
      case 'trace':
        return this.pino.trace.bind(this.pino);
      case 'debug':
        return this.pino.debug.bind(this.pino);
      case 'info':
        return this.pino.info.bind(this.pino);
      case 'warn':
        return this.pino.warn.bind(this.pino);
      case 'error':
        return this.pino.error.bind(this.pino);
      case 'fatal':
        return this.pino.fatal.bind(this.pino);
    }
  }

  logStructured(
    level: LogLevel,
    message: string,
    fields: Record<string, unknown> = {},
  ): void {
    this.toPino(level)(fields, message);
  }

  log(level: LogLevel, message: string): void {
    this.toPino(level)(message);
  }

  info(message: string, fields: Record<string, unknown> = {}): void {
    this.logStructured('info', message, fields);
  }

  warn(message: string, fields: Record<string, unknown> = {}): void {
    this.logStructured('warn', message, fields);
  }

  error(message: string, fields: Record<string, unknown> = {}): void {
    this.logStructured('error', message, fields);
  }

  debug(message: string, fields: Record<string, unknown> = {}): void {
    this.logStructured('debug', message, fields);
  }
}
