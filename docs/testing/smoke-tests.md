# Smoke Tests & Test Fixtures

## What are smoke tests?

Smoke tests verify that the most critical user flows work end-to-end after a deployment. They are **not** exhaustive — they confirm the app boots, connects to dependencies, and can handle a "happy path" request.

Run smoke tests:
- After every deploy to staging/production
- Before a release candidate is tagged
- When infrastructure changes (DB migrations, env vars, new services)

## Running tests

```bash
# All workspaces
bun test --workspaces

# Shared package only
cd apps/shared && bun test

# API only
cd apps/api && bun test
```

## Shared test utilities

All testing helpers live in `apps/shared/src/testing/` and are re-exported from the package root.

### Constants

```ts
import {
  VALID_STELLAR_ADDRESS,
  VALID_UUID,
  NON_EXISTENT_UUID,
  BASE_DATE,
  VALID_TX_HASH,
} from "@real-estate-defi/shared";
```

These replace locally-duplicated values like `const VALID_STELLAR_ADDRESS = "G..."` that appear across test files.

### Factories

Each factory returns a schema-compliant object with realistic defaults and accepts `Partial<T>` overrides:

```ts
import { createUser, createProperty, createLendingPool } from "@real-estate-defi/shared";

// Defaults — approved KYC user with Miami address
const user = createUser();

// Override specific fields
const pendingUser = createUser({
  kycStatus: "pending",
  kycTier: "basic",
});

// Property with custom valuation
const property = createProperty({ totalValue: "5000000" });
```

Available factories:
- `createUser(overrides?)`
- `createKycDocument(overrides?)`
- `createPropertyLocation(overrides?)`
- `createProperty(overrides?)`
- `createLendingPool(overrides?)`
- `createDepositPosition(overrides?)`
- `createBorrowPosition(overrides?)`
- `createTransaction(overrides?)`
- `createOraclePrice(overrides?)`

Call `resetFactorySequence()` between test suites if you need deterministic IDs.

### Staging scenarios

Pre-composed fixtures that represent realistic product states:

```ts
import {
  MIAMI_PROPERTY_SCENARIO,
  USDC_LENDING_SCENARIO,
  USER_ONBOARDING_SCENARIO,
} from "@real-estate-defi/shared";

// Miami property with owner, 3 investors, and purchase transactions
const { owner, property, investors, transactions } = MIAMI_PROPERTY_SCENARIO;

// USDC pool with 3 depositors and 2 borrowers at different health factors
const { pool, depositors, borrowers } = USDC_LENDING_SCENARIO;

// User progression: new -> pending -> verified -> rejected
const { newUser, pendingUser, verifiedUser, rejectedUser } = USER_ONBOARDING_SCENARIO;
```

## Example: API route test

```ts
import { describe, it, expect } from "bun:test";
import { createUser, VALID_UUID } from "@real-estate-defi/shared";

describe("GET /users/:id", () => {
  it("should return user data", async () => {
    const expected = createUser({ id: VALID_UUID });
    // ... seed DB, make request, assert shape matches expected
  });
});
```

## Example: Webapp component test

```ts
import { createProperty, MIAMI_PROPERTY_SCENARIO } from "@real-estate-defi/shared";

test("PropertyCard renders price", () => {
  const property = createProperty({ totalValue: "3500000" });
  // ... render component with property, assert "$3,500,000" visible
});
```
