/**
 * Staging scenarios — pre-built fixtures that represent realistic
 * launch-grade data flows for smoke testing and integration tests.
 */
import {
  createUser,
  createProperty,
  createLendingPool,
  createDepositPosition,
  createBorrowPosition,
  createTransaction,
  createKycDocument,
} from "./factories";
import { VALID_STELLAR_ADDRESS, VALID_STELLAR_ADDRESS_2 } from "./constants";

// ---------------------------------------------------------------------------
// Miami property tokenisation scenario
// ---------------------------------------------------------------------------

const miamiOwner = createUser({ displayName: "Miami Owner" });
const miamiProperty = createProperty({
  owner: miamiOwner.walletAddress,
  totalShares: 2000,
  availableShares: 1870,
  pricePerShare: "1000",
  totalValue: "2000000",
});

const investor1 = createUser({
  displayName: "Investor A",
  email: "investorA@example.com",
});
const investor2 = createUser({
  displayName: "Investor B",
  email: "investorB@example.com",
});
const investor3 = createUser({
  displayName: "Investor C",
  email: "investorC@example.com",
});

export const MIAMI_PROPERTY_SCENARIO = {
  owner: miamiOwner,
  property: miamiProperty,
  investors: [
    { user: investor1, shares: 50 },
    { user: investor2, shares: 30 },
    { user: investor3, shares: 50 },
  ],
  transactions: [
    createTransaction({
      type: "buy_shares",
      from: investor1.walletAddress,
      amount: "50000",
    }),
    createTransaction({
      type: "buy_shares",
      from: investor2.walletAddress,
      amount: "30000",
    }),
    createTransaction({
      type: "buy_shares",
      from: investor3.walletAddress,
      amount: "50000",
    }),
  ],
} as const;

// ---------------------------------------------------------------------------
// USDC lending pool scenario
// ---------------------------------------------------------------------------

const usdcPool = createLendingPool({
  name: "USDC Main Pool",
  totalDeposits: "110000",
  totalBorrows: "35000",
  availableLiquidity: "75000",
  utilizationRate: 31.8,
  supplyAPY: 6.5,
  borrowAPY: 9.2,
});

export const USDC_LENDING_SCENARIO = {
  pool: usdcPool,
  depositors: [
    {
      user: createUser({ displayName: "Depositor A" }),
      position: createDepositPosition({
        poolId: usdcPool.id,
        amount: "50000",
        shares: "50000",
        accruedInterest: "325.00",
      }),
    },
    {
      user: createUser({ displayName: "Depositor B" }),
      position: createDepositPosition({
        poolId: usdcPool.id,
        amount: "35000",
        shares: "35000",
        accruedInterest: "210.00",
      }),
    },
    {
      user: createUser({ displayName: "Depositor C" }),
      position: createDepositPosition({
        poolId: usdcPool.id,
        amount: "25000",
        shares: "25000",
        accruedInterest: "150.00",
      }),
    },
  ],
  borrowers: [
    {
      user: createUser({
        displayName: "Borrower A",
        walletAddress: VALID_STELLAR_ADDRESS,
      }),
      position: createBorrowPosition({
        poolId: usdcPool.id,
        principal: "20000",
        collateralAmount: "30000",
        healthFactor: 1.8,
        accruedInterest: "184.00",
      }),
    },
    {
      user: createUser({
        displayName: "Borrower B",
        walletAddress: VALID_STELLAR_ADDRESS_2,
      }),
      position: createBorrowPosition({
        poolId: usdcPool.id,
        principal: "15000",
        collateralAmount: "18000",
        healthFactor: 1.2,
        accruedInterest: "138.00",
      }),
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// User onboarding progression scenario
// ---------------------------------------------------------------------------

export const USER_ONBOARDING_SCENARIO = {
  newUser: createUser({
    displayName: "New User",
    kycStatus: "not_started",
    kycTier: "none",
    kycDocuments: [],
    email: undefined,
  }),
  pendingUser: createUser({
    displayName: "Pending User",
    kycStatus: "pending",
    kycTier: "basic",
    kycDocuments: [
      createKycDocument({ status: "pending", reviewedAt: undefined }),
    ],
  }),
  verifiedUser: createUser({
    displayName: "Verified User",
    kycStatus: "approved",
    kycTier: "verified",
    kycDocuments: [createKycDocument({ status: "approved" })],
  }),
  rejectedUser: createUser({
    displayName: "Rejected User",
    kycStatus: "rejected",
    kycTier: "none",
    kycDocuments: [
      createKycDocument({
        status: "rejected",
        rejectionReason: "Document expired",
      }),
    ],
  }),
} as const;
