# C1-017: Add Structured Logging Service

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                          |
| --------------- | ------------------------------ |
| Issue ID        | C1-017                         |
| Title           | Add structured logging service |
| Area            | API                            |
| Difficulty      | Trivial                        |
| Labels          | backend, logging, trivial      |
| Dependencies    | None                           |
| Estimated Lines | 50-80                          |

## Overview

Structured logging provides consistent, parseable log output that can be easily ingested by log aggregation systems. This implementation creates a lightweight logger with JSON output.

## Implementation Steps

### Step 1: Create Logger Service

Create `apps/api/src/services/logger.ts`:

```typescript
/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  pretty: boolean;
  includeStack: boolean;
}

/**
 * Default configuration
 */
const defaultConfig: LoggerConfig = {
  level: process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
  pretty: process.env.NODE_ENV !== "production",
  includeStack: true,
};

/**
 * Logger class with structured JSON output
 */
class Logger {
  private config: LoggerConfig;
  private defaultContext: Record<string, unknown> = {};

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Set default context to include in all logs
   */
  setDefaultContext(context: Record<string, unknown>): void {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const childLogger = new Logger(this.config);
    childLogger.setDefaultContext({ ...this.defaultContext, ...context });
    return childLogger;
  }

  /**
   * Format and output log entry
   */
  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
  ): void {
    if (level < this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      context: { ...this.defaultContext, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.config.includeStack ? error.stack : undefined,
      };
    }

    const output = this.config.pretty
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    if (level >= LogLevel.ERROR) {
      console.error(output);
    } else if (level >= LogLevel.WARN) {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, "debug", message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, "info", message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, "warn", message, context);
  }

  /**
   * Log error message
   */
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.log(LogLevel.ERROR, "error", message, context, error);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create logger with custom config
 */
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}
```

### Step 2: Create Request Logging Middleware

Create `apps/api/src/middleware/requestLogger.ts`:

```typescript
import { Elysia } from "elysia";
import { logger } from "../services/logger";
import { randomUUID } from "crypto";

/**
 * Request logging middleware
 * Logs all incoming requests with timing information
 */
export const requestLogger = new Elysia({ name: "request-logger" })
  .derive(({ request }) => {
    const requestId = randomUUID();
    const startTime = Date.now();

    return {
      requestId,
      startTime,
      requestLogger: logger.child({ requestId }),
    };
  })
  .onBeforeHandle(({ request, requestId, requestLogger }) => {
    requestLogger.info("Request started", {
      method: request.method,
      path: new URL(request.url).pathname,
      userAgent: request.headers.get("user-agent"),
    });
  })
  .onAfterHandle(({ request, requestId, startTime, set }) => {
    const duration = Date.now() - startTime;
    const requestLogger = logger.child({ requestId });

    requestLogger.info("Request completed", {
      method: request.method,
      path: new URL(request.url).pathname,
      status: set.status || 200,
      duration: `${duration}ms`,
    });
  })
  .onError(({ request, error, requestId, startTime, set }) => {
    const duration = Date.now() - startTime;
    const requestLogger = logger.child({ requestId });

    requestLogger.error(
      "Request failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        method: request.method,
        path: new URL(request.url).pathname,
        status: set.status || 500,
        duration: `${duration}ms`,
      },
    );
  });

/**
 * Add request ID header to response
 */
export const requestIdHeader = new Elysia({ name: "request-id-header" })
  .derive(({ set }) => {
    return {
      setRequestIdHeader: (requestId: string) => {
        set.headers["x-request-id"] = requestId;
      },
    };
  })
  .onBeforeHandle(({ requestId, setRequestIdHeader }) => {
    if (requestId) {
      setRequestIdHeader(requestId);
    }
  });
```

### Step 3: Update Middleware Index

Update `apps/api/src/middleware/index.ts`:

```typescript
export { errorHandler } from "./errorHandler";
export {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  uuidParamSchema,
  paginationQuerySchema,
} from "./validation";
export { requestLogger, requestIdHeader } from "./requestLogger";
```

### Step 4: Update Main Application

Update `apps/api/src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { requestLogger, requestIdHeader, errorHandler } from "./middleware";
import { propertyRoutes } from "./routes/properties";
import { lendingRoutes } from "./routes/lending";
import { userRoutes } from "./routes/users";
import { kycRoutes } from "./routes/kyc";
import { checkDatabaseHealth } from "./db";
import { logger } from "./services/logger";

const app = new Elysia()
  // Global middleware
  .use(cors())
  .use(swagger())
  .use(requestLogger)
  .use(requestIdHeader)
  .use(errorHandler)

  // Health check
  .get("/health", async () => {
    const dbHealth = await checkDatabaseHealth();
    return {
      status: dbHealth.healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      services: { database: dbHealth },
    };
  })

  // API routes
  .use(propertyRoutes)
  .use(lendingRoutes)
  .use(userRoutes)
  .use(kycRoutes)

  // Start server
  .listen(process.env.PORT || 3001);

logger.info("Server started", {
  port: app.server?.port,
  environment: process.env.NODE_ENV,
});

export { app };
```

## Usage Examples

### In Controllers

```typescript
import { logger } from "../services/logger";

export class PropertyController {
  static async create(ctx: Context) {
    const { requestLogger } = ctx;

    requestLogger.debug("Creating property", { body: ctx.body });

    try {
      const property = await propertyRepository.create(ctx.body);
      requestLogger.info("Property created", { propertyId: property.id });
      return property;
    } catch (error) {
      requestLogger.error("Failed to create property", error as Error);
      throw error;
    }
  }
}
```

### Direct Usage

```typescript
import { logger } from "./services/logger";

// Simple logging
logger.info("Application starting");
logger.debug("Configuration loaded", { config });

// With context
logger.info("User authenticated", { userId: "abc123" });

// Error logging
try {
  await riskyOperation();
} catch (error) {
  logger.error("Operation failed", error as Error, { operationId: "xyz" });
}

// Child logger with persistent context
const userLogger = logger.child({ userId: "abc123" });
userLogger.info("User action"); // Includes userId in all logs
```

## Sample Log Output

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "method": "GET",
    "path": "/properties",
    "status": 200,
    "duration": "45ms"
  }
}
```

```json
{
  "timestamp": "2024-01-15T10:30:01.000Z",
  "level": "error",
  "message": "Database query failed",
  "context": {
    "requestId": "550e8400-e29b-41d4-a716-446655440001",
    "query": "SELECT * FROM properties"
  },
  "error": {
    "name": "DatabaseError",
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at ..."
  }
}
```

## Related Resources

| Resource           | Link                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Structured Logging | https://www.loggly.com/blog/why-json-is-the-best-application-log-format-and-how-to-switch/ |
| Elysia Lifecycle   | https://elysiajs.com/concept/lifecycle.html                                                |

## Verification Checklist

| Item                       | Status |
| -------------------------- | ------ |
| Logger service created     |        |
| Request middleware created |        |
| JSON output working        |        |
| Log levels filtering       |        |
| Request timing logged      |        |
| Request ID in headers      |        |
| Error stack traces         |        |
