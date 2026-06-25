import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ApiError } from '../errors/ApiError';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

/**
 * The shape of context properties derived by authPlugin.
 * Use this as an intersection in controller method signatures that call getAuthenticatedUser.
 */
export type AuthContext = {
  getAuthenticatedUser: () => Promise<{ id: string; walletAddress: string }>;
};

export const authPlugin = new Elysia()
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
    }),
  )
  .derive({ as: 'global' }, ({ jwt, headers }) => {
    return {
      getAuthenticatedUser: async (): Promise<{ id: string; walletAddress: string }> => {
        const authHeader = headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
        }

        const token = authHeader.substring(7);
        const payload = await jwt.verify(token);

        if (!payload) {
          throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
        }

        return {
          id: payload.id as string,
          walletAddress: payload.walletAddress as string,
        };
      },
    };
  });
