import { describe, expect, it } from 'bun:test';
import {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  handleError,
} from '../utils/errors';

describe('Error Utilities', () => {
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

    it('should handle standard Error correctly', () => {
      const error = new Error('Something went wrong');
      const response = handleError(error);

      expect(response.success).toBe(false);
      expect(response.error).toBe('INTERNAL_ERROR');
      expect(response.message).toBe('Something went wrong');
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
});
