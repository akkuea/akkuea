import { Elysia } from 'elysia';
import { ApiError } from '../errors/ApiError';
import { userRepository } from '../repositories/UserRepository';

/**
 * Authenticated user context
 */
export interface AuthenticatedUser {
  id: string;
  walletAddress?: string;
  isAdmin?: boolean;
}

/**
 * Middleware: Require authentication
 * Extracts user identity from x-user-id or x-user-address headers
 */
export const requireAuth = async (ctx: {
  headers: Record<string, string | undefined>;
}): Promise<AuthenticatedUser> => {
  const userId = ctx.headers['x-user-id'];
  const walletAddress = ctx.headers['x-user-address'];

  if (userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.unauthorized('Invalid user ID');
    }
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      // TODO: Add isAdmin field to user schema when RBAC is implemented
      isAdmin: false,
    };
  }

  if (walletAddress) {
    const user = await userRepository.findByWalletAddress(walletAddress);
    if (!user) {
      throw ApiError.unauthorized('Invalid wallet address');
    }
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      // TODO: Add isAdmin field to user schema when RBAC is implemented
      isAdmin: false,
    };
  }

  throw ApiError.unauthorized('Authentication required');
};

/**
 * Middleware: Require internal API key
 * Validates x-internal-api-key header against environment variable
 */
export const requireInternalApiKey = (ctx: {
  headers: Record<string, string | undefined>;
}): void => {
  const apiKey = ctx.headers['x-internal-api-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!expectedKey) {
    throw ApiError.internal('Internal API key not configured');
  }

  if (!apiKey || apiKey !== expectedKey) {
    throw ApiError.unauthorized('Invalid or missing internal API key');
  }
};

/**
 * Middleware: Require ownership or admin access
 * Ensures the authenticated user is either the resource owner or an admin
 */
export const requireOwnership = (
  user: AuthenticatedUser,
  resourceOwnerId: string,
): void => {
  if (user.isAdmin) {
    return; // Admins can access any resource
  }

  if (user.id !== resourceOwnerId) {
    throw ApiError.forbidden('You do not have permission to access this resource');
  }
};

/**
 * Elysia plugin wrapper for requireAuth
 */
export const authPlugin = new Elysia({ name: 'auth-plugin' }).derive(
  async ({ headers }: { headers: Record<string, string | undefined> }) => {
    const user = await requireAuth({ headers });
    return { user };
  },
);

/**
 * Elysia plugin wrapper for requireInternalApiKey
 */
export const internalKeyPlugin = new Elysia({ name: 'internal-key-plugin' }).derive(
  ({ headers }: { headers: Record<string, string | undefined> }) => {
    requireInternalApiKey({ headers });
    return { isInternal: true };
  },
);
