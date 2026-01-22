type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, unknown>;
    error?: unknown;
}

export class LoggerService {
    private level: LogLevel = 'info';

    constructor(level: LogLevel = 'info') {
        this.level = level;
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

    private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
        };
        if (context) entry.context = context;
        if (error) entry.error = this.formatError(error);

        const output = JSON.stringify(entry);

        if (level === 'error') {
            console.error(output);
        } else {
            console.log(output);
        }
    }

    debug(message: string, context?: Record<string, unknown>) {
        if (this.level === 'debug') {
            this.log('debug', message, context);
        }
    }

    info(message: string, context?: Record<string, unknown>) {
        if (this.level === 'debug' || this.level === 'info') {
            this.log('info', message, context);
        }
    }

    warn(message: string, context?: Record<string, unknown>) {
        if (this.level !== 'error') {
            this.log('warn', message, context);
        }
    }

    error(message: string, error?: unknown, context?: Record<string, unknown>) {
        this.log('error', message, context, error);
    }
}

// Export singleton
export const logger = new LoggerService(
    (process.env.LOG_LEVEL as LogLevel) || 'info'
);
