type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  operation?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  duration?: number;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
       
      console.debug(formatMessage('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
       
      console.info(formatMessage('info', message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
       
      console.warn(formatMessage('warn', message, context));
    }
  },

  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
       
      console.error(formatMessage('error', message, context));
    }
  },

  crud: {
    create(entity: string, data: Record<string, unknown>, userId?: string): void {
      logger.info(`Creating ${entity}`, { operation: 'CREATE', entity, userId, ...data });
    },

    read(entity: string, entityId?: string, userId?: string): void {
      logger.info(`Reading ${entity}${entityId ? ` with id ${entityId}` : 's'}`, {
        operation: 'READ',
        entity,
        entityId,
        userId,
      });
    },

    update(entity: string, entityId: string, data: Record<string, unknown>, userId?: string): void {
      logger.info(`Updating ${entity} with id ${entityId}`, {
        operation: 'UPDATE',
        entity,
        entityId,
        userId,
        ...data,
      });
    },

    delete(entity: string, entityId: string, userId?: string): void {
      logger.info(`Deleting ${entity} with id ${entityId}`, {
        operation: 'DELETE',
        entity,
        entityId,
        userId,
      });
    },

    success(operation: string, entity: string, entityId?: string, duration?: number): void {
      logger.info(`${operation} ${entity} completed successfully`, {
        operation,
        entity,
        entityId,
        duration,
      });
    },

    failure(operation: string, entity: string, error: Error, entityId?: string): void {
      logger.error(`${operation} ${entity} failed: ${error.message}`, {
        operation,
        entity,
        entityId,
        error: error.message,
        stack: error.stack,
      });
    },
  },
};
