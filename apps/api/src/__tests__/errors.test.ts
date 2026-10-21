import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test';
import { Elysia, t } from 'elysia';
import { NotFoundError as SharedNotFoundError } from '@akkuea/shared';
import { ApiError } from '../errors/ApiError';
import { errorHandler } from '../middleware/errorHandler';
import {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  handleError,
  type ErrorResponse,
} from '../utils/errors';

describe('Error Utilities', () => {
  let consoleErrorSpy: Mock<typeof console.error>;

  beforeEach(() => {
    // Unknown errors are logged server-side; keep the test output readable.
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('AppError', () => {
    it('should create an AppError with default values', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.name).toBe('AppError');
    });

    it('should create an AppError with custom values', () => {
      const error = new AppError('Custom error', 422, 'CUSTOM_ERROR');

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('CUSTOM_ERROR');
    });
  });

  describe('BadRequestError', () => {
    it('should create a BadRequestError with status 400', () => {
      const error = new BadRequestError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.name).toBe('BadRequestError');
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with status 404', () => {
      const error = new NotFoundError('Resource not found');

      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an UnauthorizedError with status 401', () => {
      const error = new UnauthorizedError('Not authenticated');

      expect(error.message).toBe('Not authenticated');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should use default message when not provided', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with status 403', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.name).toBe('ForbiddenError');
    });

    it('should use default message when not provided', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
    });
  });

  describe('handleError', () => {
    it('should handle AppError correctly', () => {
      const error = new BadRequestError('Invalid data');
      const response = handleError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('BAD_REQUEST');
      expect(response.message).toBe('Invalid data');
      expect(response.statusCode).toBe(400);
      expect(response.timestamp).toBeDefined();
    });

    it('should handle shared package AppError subclasses', () => {
      const error = new SharedNotFoundError('Property', 'abc');
      const response = handleError(error);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(404);
      expect(response.message).toContain('abc');
    });

    it('should hide the message of a standard Error', () => {
      const error = new Error('Something went wrong');
      const response = handleError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('INTERNAL_ERROR');
      expect(response.message).toBe('An unexpected error occurred');
      expect(response.statusCode).toBe(500);
    });

    it('should keep the message, code, and status of an ApiError', () => {
      const response = handleError(ApiError.notFound('Property not found'));

      expect(response.error).toBe('NOT_FOUND');
      expect(response.message).toBe('Property not found');
      expect(response.statusCode).toBe(404);
    });

    it('should sanitize driver errors that carry a code', () => {
      const pgError = Object.assign(
        new Error('duplicate key value violates unique constraint "users_email_key"'),
        { code: '23505', detail: 'Key (email)=(a@b.c) already exists.' },
      );
      const response = handleError(pgError);

      expect(response.error).toBe('INTERNAL_ERROR');
      expect(response.message).toBe('An unexpected error occurred');
      expect(response.statusCode).toBe(500);
    });

    it('should sanitize plain objects that carry a code and status', () => {
      const response = handleError({
        code: '42P01',
        status: 400,
        message: 'relation "secret_table" does not exist',
      });

      expect(response.error).toBe('INTERNAL_ERROR');
      expect(response.message).toBe('An unexpected error occurred');
      expect(response.statusCode).toBe(500);
    });

    it('should handle unknown errors correctly', () => {
      const response = handleError('string error');

      expect(response.success).toBe(false);
      expect(response.error).toBe('INTERNAL_ERROR');
      expect(response.message).toBe('An unexpected error occurred');
      expect(response.statusCode).toBe(500);
    });

    it('should handle null/undefined errors', () => {
      const response = handleError(null);

      expect(response.success).toBe(false);
      expect(response.statusCode).toBe(500);
    });
  });

  describe('errorHandler responses', () => {
    const app = new Elysia()
      .use(errorHandler)
      .get('/plain-error', () => {
        throw new Error('select * from secret_table');
      })
      .get('/postgres-error', () => {
        throw Object.assign(new Error('relation "secret_table" does not exist'), {
          code: '42P01',
          severity: 'ERROR',
          query: 'select * from secret_table',
        });
      })
      .get('/api-error', () => {
        throw ApiError.notFound('Property not found');
      })
      .post('/validated', ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      });

    const request = (path: string, init?: RequestInit) =>
      app.handle(new Request(`http://localhost${path}`, init));

    it('returns a generic 500 for a plain Error and logs the original server-side', async () => {
      const response = await request('/plain-error');
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).not.toContain('secret_table');
      expect(JSON.parse(text)).toMatchObject({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        statusCode: 500,
      });

      const logged = consoleErrorSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('select * from secret_table');
    });

    it('returns a generic 500 for a Postgres-like error with a code', async () => {
      const response = await request('/postgres-error');
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(text).not.toContain('secret_table');
      expect(text).not.toContain('42P01');
      expect(JSON.parse(text)).toMatchObject({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });

      const logged = consoleErrorSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('42P01');
    });

    it('passes an ApiError 404 through unchanged', async () => {
      const response = await request('/api-error');

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({
        success: false,
        error: 'NOT_FOUND',
        message: 'Property not found',
        statusCode: 404,
      });
    });

    it('keeps the status and message of a validation error', async () => {
      const response = await request('/validated', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 42 }),
      });
      const body = (await response.json()) as ErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation Error');
      expect(body.statusCode).toBe(400);
      expect(body.message).not.toBe('An unexpected error occurred');
      expect(body.message).toContain('name');
    });

    it('keeps the 404 for an unknown route', async () => {
      const response = await request('/does-not-exist');

      expect(response.status).toBe(404);
      expect(((await response.json()) as ErrorResponse).error).toBe('NOT_FOUND');
    });
  });
});
