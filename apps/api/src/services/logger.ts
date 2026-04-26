type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  operation?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Consolidated Logger Service
 *
 * Features:
 * - Structured JSON logging
 * - Log level filtering
 * - CRUD operation helpers
 * - Error formatting
 */
export class LoggerService {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      };
    }
    return { message: String(error) };
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: unknown) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }
    if (error) {
      entry.error = this.formatError(error);
    }

    const output = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, errorOrContext?: unknown | LogContext, context?: LogContext): void {
    // Handle both signatures:
    // error(message, error, context) - legacy
    // error(message, context) - new with error in context
    if (errorOrContext instanceof Error || (errorOrContext && typeof errorOrContext !== 'object')) {
      this.log('error', message, context, errorOrContext);
    } else {
      this.log('error', message, errorOrContext as LogContext);
    }
  }

  /**
   * CRUD operation logging helpers
   */
  crud = {
    create: (entity: string, data?: Record<string, unknown>, userId?: string): void => {
      this.info(`Creating ${entity}`, { operation: 'CREATE', entity, userId, ...data });
    },

    read: (entity: string, entityId?: string, userId?: string): void => {
      this.info(`Reading ${entity}${entityId ? ` with id ${entityId}` : 's'}`, {
        operation: 'READ',
        entity,
        entityId,
        userId,
      });
    },

    update: (
      entity: string,
      entityId: string,
      data?: Record<string, unknown>,
      userId?: string,
    ): void => {
      this.info(`Updating ${entity} with id ${entityId}`, {
        operation: 'UPDATE',
        entity,
        entityId,
        userId,
        ...data,
      });
    },

    delete: (entity: string, entityId: string, userId?: string): void => {
      this.info(`Deleting ${entity} with id ${entityId}`, {
        operation: 'DELETE',
        entity,
        entityId,
        userId,
      });
    },

    success: (operation: string, entity: string, entityId?: string, duration?: number): void => {
      this.info(`${operation} ${entity} completed successfully`, {
        operation,
        entity,
        entityId,
        duration,
      });
    },

    failure: (operation: string, entity: string, error: Error, entityId?: string): void => {
      this.log(
        'error',
        `${operation} ${entity} failed: ${error.message}`,
        {
          operation,
          entity,
          entityId,
        },
        error,
      );
    },
  };
}

// Export singleton instance
export const logger = new LoggerService((process.env.LOG_LEVEL as LogLevel) || 'info');
