import { Elysia } from 'elysia';
import { handleError } from '../utils/errors';
import { captureErrorSafely } from '@akkuea/shared';

export const errorHandler = new Elysia().onError({ as: 'global' }, ({ error, code, set }) => {
  const result = handleError(error);

  captureErrorSafely(error, {
    code,
    statusCode: result.statusCode,
    message: result.message,
    context: 'api-error-handler',
  });

  if (code === 'VALIDATION') {
    set.status = 400;
    return {
      ...result,
      error: 'Validation Error',
      statusCode: 400,
    };
  }

  if (code === 'NOT_FOUND' && result.statusCode === 500) {
    set.status = 404;
    return {
      ...result,
      error: 'Not Found',
      statusCode: 404,
    };
  }

  set.status = result.statusCode;
  return result;
});
