# C1-013: Implement User CRUD Operations in UserController

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                            |
| --------------- | ------------------------------------------------ |
| Issue ID        | C1-013                                           |
| Title           | Implement user CRUD operations in UserController |
| Area            | API                                              |
| Difficulty      | Medium                                           |
| Labels          | backend, api, medium                             |
| Dependencies    | None                                             |
| Estimated Lines | 120-180                                          |

## Overview

This issue implements the user management layer including registration, profile management, and wallet-based lookups. Users are identified primarily by their Stellar wallet address.

## Implementation Steps

### Step 1: Create User DTOs

Create `apps/api/src/dto/user.dto.ts`:

```typescript
import { z } from "zod";

/**
 * Stellar address validation regex
 */
const stellarAddressRegex = /^G[A-Z2-7]{55}$/;

/**
 * Create user request schema
 */
export const CreateUserDto = z.object({
  walletAddress: z
    .string()
    .length(56, "Wallet address must be 56 characters")
    .regex(stellarAddressRegex, "Invalid Stellar address format"),
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

/**
 * Update user request schema
 */
export const UpdateUserDto = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

/**
 * User response schema (for type inference)
 */
export const UserResponseDto = z.object({
  id: z.string().uuid(),
  walletAddress: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  kycStatus: z.enum([
    "not_started",
    "pending",
    "approved",
    "rejected",
    "expired",
  ]),
  kycTier: z.enum(["none", "basic", "verified", "accredited"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
export type UpdateUserInput = z.infer<typeof UpdateUserDto>;
export type UserResponse = z.infer<typeof UserResponseDto>;
```

### Step 2: Create User Repository

Create `apps/api/src/repositories/UserRepository.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { BaseRepository } from "./BaseRepository";

type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;

export class UserRepository extends BaseRepository<
  typeof users,
  NewUser,
  User
> {
  constructor() {
    super(users);
  }

  /**
   * Find user by wallet address
   */
  async findByWalletAddress(walletAddress: string): Promise<User | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);

    return results[0];
  }

  /**
   * Check if wallet address exists
   */
  async walletExists(walletAddress: string): Promise<boolean> {
    const user = await this.findByWalletAddress(walletAddress);
    return !!user;
  }

  /**
   * Create user with wallet address
   */
  async createUser(data: {
    walletAddress: string;
    email?: string;
    displayName?: string;
  }): Promise<User> {
    return this.create({
      walletAddress: data.walletAddress,
      email: data.email || null,
      displayName: data.displayName || null,
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(
    id: string,
    data: { email?: string; displayName?: string },
  ): Promise<User | undefined> {
    const updateData: Partial<NewUser> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) {
      updateData.email = data.email;
    }

    if (data.displayName !== undefined) {
      updateData.displayName = data.displayName;
    }

    return this.update(id, updateData);
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  /**
   * Get or create user by wallet
   */
  async getOrCreateByWallet(walletAddress: string): Promise<User> {
    const existing = await this.findByWalletAddress(walletAddress);

    if (existing) {
      await this.updateLastLogin(existing.id);
      return existing;
    }

    return this.createUser({ walletAddress });
  }
}

export const userRepository = new UserRepository();
```

### Step 3: Implement UserController

Update `apps/api/src/controllers/UserController.ts`:

```typescript
import { Context } from "elysia";
import { userRepository } from "../repositories/UserRepository";
import { CreateUserDto, UpdateUserDto } from "../dto/user.dto";
import { ApiError } from "../errors/ApiError";

export class UserController {
  /**
   * Create new user
   */
  static async create(ctx: Context): Promise<Response> {
    const body = await ctx.request.json();
    const validationResult = CreateUserDto.safeParse(body);

    if (!validationResult.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid user data", {
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const { walletAddress, email, displayName } = validationResult.data;

    // Check for existing wallet
    const exists = await userRepository.walletExists(walletAddress);
    if (exists) {
      throw new ApiError(
        409,
        "WALLET_EXISTS",
        "User with this wallet address already exists",
      );
    }

    const user = await userRepository.createUser({
      walletAddress,
      email,
      displayName,
    });

    return new Response(JSON.stringify(user), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get current user profile (authenticated)
   */
  static async getProfile(ctx: Context): Promise<Response> {
    const userId = ctx.headers.get("x-user-id");

    if (!userId) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get user by ID
   */
  static async getById(
    ctx: Context<{ params: { id: string } }>,
  ): Promise<Response> {
    const { id } = ctx.params;

    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", `User with ID ${id} not found`);
    }

    // Return public profile (omit sensitive fields)
    const publicProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      kycTier: user.kycTier,
      createdAt: user.createdAt,
    };

    return new Response(JSON.stringify(publicProfile), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get user by wallet address
   */
  static async getByWallet(
    ctx: Context<{ params: { address: string } }>,
  ): Promise<Response> {
    const { address } = ctx.params;

    // Validate wallet address format
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      throw new ApiError(
        400,
        "INVALID_ADDRESS",
        "Invalid Stellar address format",
      );
    }

    const user = await userRepository.findByWalletAddress(address);

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    // Return public profile
    const publicProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      kycTier: user.kycTier,
      createdAt: user.createdAt,
    };

    return new Response(JSON.stringify(publicProfile), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Update current user profile
   */
  static async updateProfile(ctx: Context): Promise<Response> {
    const userId = ctx.headers.get("x-user-id");

    if (!userId) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    const body = await ctx.request.json();
    const validationResult = UpdateUserDto.safeParse(body);

    if (!validationResult.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid update data", {
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const user = await userRepository.updateProfile(
      userId,
      validationResult.data,
    );

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Authenticate user by wallet (get or create)
   */
  static async authenticateByWallet(ctx: Context): Promise<Response> {
    const body = await ctx.request.json();
    const { walletAddress } = body;

    if (!walletAddress || !/^G[A-Z2-7]{55}$/.test(walletAddress)) {
      throw new ApiError(
        400,
        "INVALID_ADDRESS",
        "Invalid Stellar address format",
      );
    }

    const user = await userRepository.getOrCreateByWallet(walletAddress);

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

### Step 4: Update User Routes

Update `apps/api/src/routes/users.ts`:

```typescript
import { Elysia } from "elysia";
import { z } from "zod";
import { validate, uuidParamSchema } from "../middleware";
import { UserController } from "../controllers/UserController";

const walletParamSchema = z.object({
  address: z.string().length(56),
});

const createUserSchema = z.object({
  walletAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

const authWalletSchema = z.object({
  walletAddress: z
    .string()
    .length(56)
    .regex(/^G[A-Z2-7]{55}$/),
});

export const userRoutes = new Elysia({ prefix: "/users" })
  // POST /users - Create user
  .use(validate({ body: createUserSchema }))
  .post("/", async (ctx) => UserController.create(ctx))

  // GET /users/me - Get current user profile
  .get("/me", async (ctx) => UserController.getProfile(ctx))

  // PATCH /users/me - Update current user profile
  .use(validate({ body: updateUserSchema }))
  .patch("/me", async (ctx) => UserController.updateProfile(ctx))

  // GET /users/:id - Get user by ID
  .use(validate({ params: uuidParamSchema }))
  .get("/:id", async (ctx) => UserController.getById(ctx))

  // GET /users/wallet/:address - Get user by wallet address
  .use(validate({ params: walletParamSchema }))
  .get("/wallet/:address", async (ctx) => UserController.getByWallet(ctx))

  // POST /users/auth - Authenticate by wallet (get or create)
  .use(validate({ body: authWalletSchema }))
  .post("/auth", async (ctx) => UserController.authenticateByWallet(ctx));
```

## Testing Guidelines

### Integration Test Example

```typescript
import { describe, it, expect } from "bun:test";
import { app } from "../src/index";

describe("UserController", () => {
  const testWallet =
    "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

  describe("POST /users", () => {
    it("should create a new user", async () => {
      const response = await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: testWallet }),
        }),
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.walletAddress).toBe(testWallet);
    });

    it("should reject duplicate wallet", async () => {
      // First create
      await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: testWallet }),
        }),
      );

      // Second create should fail
      const response = await app.handle(
        new Request("http://localhost/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: testWallet }),
        }),
      );

      expect(response.status).toBe(409);
    });
  });

  describe("GET /users/wallet/:address", () => {
    it("should return user by wallet", async () => {
      const response = await app.handle(
        new Request(`http://localhost/users/wallet/${testWallet}`),
      );

      expect(response.status).toBe(200);
    });

    it("should return 400 for invalid address", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/wallet/invalid"),
      );

      expect(response.status).toBe(400);
    });
  });
});
```

## Related Resources

| Resource               | Link                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Stellar Address Format | https://developers.stellar.org/docs/encyclopedia/account-format |
| Drizzle ORM            | https://orm.drizzle.team                                        |

## Verification Checklist

| Item                       | Status |
| -------------------------- | ------ |
| DTOs created               |        |
| Repository implemented     |        |
| Controller methods working |        |
| Routes configured          |        |
| Validation working         |        |
| Tests passing              |        |
