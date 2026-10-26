import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { VALID_UUID } from '@akkuea/shared';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-ops-secret';
process.env.LIQUIDATOR_API_KEY = 'test-liquidator-secret';

const listPropertiesMock = mock(async () => ({
  data: [],
  pagination: { page: 1, limit: 10, total: 0 },
}));
const getPropertyDetailMock = mock(async () => ({ id: VALID_UUID }));
const applyReviewActionMock = mock(async () => ({ id: VALID_UUID, reviewStatus: 'approved' }));

mock.module('../controllers/OperationalPropertyController', () => ({
  OperationalPropertyController: {
    listProperties: listPropertiesMock,
    getPropertyDetail: getPropertyDetailMock,
    applyReviewAction: applyReviewActionMock,
  },
}));

const whitelistPendingMock = mock(async () => ({ success: true, data: [] }));
const whitelistReviewMock = mock(async () => ({ success: true, txHash: 'mock_tx_hash' }));

mock.module('../controllers/WhitelistController', () => ({
  WhitelistController: {
    pending: whitelistPendingMock,
    review: whitelistReviewMock,
  },
}));

const treasuryDepositMock = mock(async () => ({ txHash: 'mock_deposit_tx' }));
const treasuryWithdrawMock = mock(async () => ({ txHash: 'mock_withdraw_tx' }));
const treasuryGetPortfolioMock = mock(async () => ({ venues: [] }));
const treasuryGetHistoryMock = mock(async () => ({ data: [] }));

mock.module('../controllers/TreasuryController', () => ({
  treasuryController: {
    getPortfolio: treasuryGetPortfolioMock,
    getPosition: mock(async () => ({})),
    getHistory: treasuryGetHistoryMock,
    deposit: treasuryDepositMock,
    withdraw: treasuryWithdrawMock,
  },
}));

const lendingPrepareLiquidationMock = mock(
  async () => new Response(JSON.stringify({ success: true })),
);
const lendingConfirmLiquidationMock = mock(
  async () => new Response(JSON.stringify({ success: true })),
);
const lendingCreatePoolMock = mock(async () => new Response(JSON.stringify({ data: {} })));

mock.module('../controllers/LendingController', () => ({
  LendingController: {
    getPools: mock(async () => new Response(JSON.stringify({ data: [] }))),
    getPool: mock(async () => new Response(JSON.stringify({ data: {} }))),
    getUserDeposits: mock(async () => new Response(JSON.stringify({ data: [] }))),
    getUserBorrows: mock(async () => new Response(JSON.stringify({ data: [] }))),
    getUserPositionSummary: mock(async () => new Response(JSON.stringify({ data: {} }))),
    createPool: lendingCreatePoolMock,
    prepareAction: mock(async () => new Response(JSON.stringify({ data: {} }))),
    confirmAction: mock(async () => new Response(JSON.stringify({ data: {} }))),
    prepareLiquidation: lendingPrepareLiquidationMock,
    confirmLiquidation: lendingConfirmLiquidationMock,
  },
}));

// Imported after the mocks above so each route module picks up the mocked
// controllers instead of the real ones.
const { internalOperationsRoutes } = await import('./internalOperations');
const { treasuryRoutes } = await import('./treasury');
const { lendingRoutes } = await import('./lending');

const testApp = new Elysia().use(internalOperationsRoutes).use(treasuryRoutes).use(lendingRoutes);

function allControllerMocks() {
  return [
    listPropertiesMock,
    getPropertyDetailMock,
    applyReviewActionMock,
    whitelistPendingMock,
    whitelistReviewMock,
    treasuryDepositMock,
    treasuryWithdrawMock,
    lendingCreatePoolMock,
    lendingPrepareLiquidationMock,
    lendingConfirmLiquidationMock,
  ];
}

beforeEach(() => {
  for (const m of allControllerMocks()) m.mockClear();
});

const reviewBody = JSON.stringify({ action: 'approve', actorWallet: 'G'.repeat(56) });
const whitelistReviewBody = JSON.stringify({ action: 'approve' });
const treasuryMovementBody = JSON.stringify({ venue: 'defindex-blend', amount: 100 });
const createPoolBody = JSON.stringify({
  name: 'USDC Pool',
  asset: 'USDC',
  assetAddress: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  collateralFactor: '0.75',
  liquidationThreshold: '0.80',
  liquidationPenalty: '0.05',
});
const liquidator = 'GCO5CVUVFNX4KZQMYCALTJ5QSG6USOVLFQ74AQCCX7TGJKBNZ33KC5ZC';

type GuardedRoute = {
  name: string;
  path: string;
  method: string;
  body?: string;
  headerName: string;
  validKey: string;
  controllerMock: ReturnType<typeof mock>;
};

const guardedRoutes: GuardedRoute[] = [
  {
    name: 'GET /internal/operations/properties',
    path: '/internal/operations/properties',
    method: 'GET',
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: listPropertiesMock,
  },
  {
    name: 'GET /internal/operations/properties/:id',
    path: `/internal/operations/properties/${VALID_UUID}`,
    method: 'GET',
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: getPropertyDetailMock,
  },
  {
    name: 'POST /internal/operations/properties/:id/review',
    path: `/internal/operations/properties/${VALID_UUID}/review`,
    method: 'POST',
    body: reviewBody,
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: applyReviewActionMock,
  },
  {
    name: 'GET /internal/operations/pilot/whitelist/pending',
    path: '/internal/operations/pilot/whitelist/pending',
    method: 'GET',
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: whitelistPendingMock,
  },
  {
    name: 'POST /internal/operations/pilot/whitelist/:id/review',
    path: `/internal/operations/pilot/whitelist/${VALID_UUID}/review`,
    method: 'POST',
    body: whitelistReviewBody,
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: whitelistReviewMock,
  },
  {
    name: 'POST /api/v1/treasury/deposit',
    path: '/api/v1/treasury/deposit',
    method: 'POST',
    body: treasuryMovementBody,
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: treasuryDepositMock,
  },
  {
    name: 'POST /api/v1/treasury/withdraw',
    path: '/api/v1/treasury/withdraw',
    method: 'POST',
    body: treasuryMovementBody,
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: treasuryWithdrawMock,
  },
  {
    name: 'POST /lending/pools',
    path: '/lending/pools',
    method: 'POST',
    body: createPoolBody,
    headerName: 'x-internal-api-key',
    validKey: 'test-ops-secret',
    controllerMock: lendingCreatePoolMock,
  },
  {
    name: 'POST /lending/pools/:id/positions/:borrowerId/liquidate/prepare',
    path: `/lending/pools/${VALID_UUID}/positions/${VALID_UUID}/liquidate/prepare`,
    method: 'POST',
    body: JSON.stringify({ liquidator, debtToCover: '10' }),
    headerName: 'x-api-key',
    validKey: 'test-liquidator-secret',
    controllerMock: lendingPrepareLiquidationMock,
  },
  {
    name: 'POST /lending/pools/:id/positions/:borrowerId/liquidate/confirm',
    path: `/lending/pools/${VALID_UUID}/positions/${VALID_UUID}/liquidate/confirm`,
    method: 'POST',
    body: JSON.stringify({ liquidator, txHash: 'a'.repeat(64) }),
    headerName: 'x-api-key',
    validKey: 'test-liquidator-secret',
    controllerMock: lendingConfirmLiquidationMock,
  },
];

describe('Operator, treasury and liquidator guards actually apply', () => {
  for (const route of guardedRoutes) {
    describe(route.name, () => {
      it('returns 403 and never reaches the controller when no key is sent', async () => {
        const response = await testApp.handle(
          new Request(`http://localhost${route.path}`, {
            method: route.method,
            headers: { 'Content-Type': 'application/json' },
            body: route.body,
          }),
        );

        expect(response.status).toBe(403);
        expect(route.controllerMock).not.toHaveBeenCalled();
      });

      it('returns 403 and never reaches the controller when the key is wrong', async () => {
        const response = await testApp.handle(
          new Request(`http://localhost${route.path}`, {
            method: route.method,
            headers: { 'Content-Type': 'application/json', [route.headerName]: 'wrong-key' },
            body: route.body,
          }),
        );

        expect(response.status).toBe(403);
        expect(route.controllerMock).not.toHaveBeenCalled();
      });

      it('reaches the controller when the key is correct', async () => {
        const response = await testApp.handle(
          new Request(`http://localhost${route.path}`, {
            method: route.method,
            headers: {
              'Content-Type': 'application/json',
              [route.headerName]: route.validKey,
            },
            body: route.body,
          }),
        );

        expect(response.status).not.toBe(403);
        expect(route.controllerMock).toHaveBeenCalled();
      });
    });
  }

  describe('POST /lending/pools/:id/positions/:borrowerId/liquidate (retired)', () => {
    const path = `/lending/pools/${VALID_UUID}/positions/${VALID_UUID}/liquidate`;

    it('returns 403, not 500, when no key is sent', async () => {
      const response = await testApp.handle(
        new Request(`http://localhost${path}`, { method: 'POST' }),
      );

      expect(response.status).toBe(403);
    });

    it('returns 410 with the key and never reaches a controller', async () => {
      const response = await testApp.handle(
        new Request(`http://localhost${path}`, {
          method: 'POST',
          headers: { 'x-api-key': 'test-liquidator-secret' },
        }),
      );

      expect(response.status).toBe(410);
      expect(lendingPrepareLiquidationMock).not.toHaveBeenCalled();
      expect(lendingConfirmLiquidationMock).not.toHaveBeenCalled();
    });
  });

  describe('public treasury routes stay public', () => {
    it('GET /api/v1/treasury requires no key', async () => {
      const response = await testApp.handle(new Request('http://localhost/api/v1/treasury'));
      expect(response.status).not.toBe(403);
      expect(treasuryGetPortfolioMock).toHaveBeenCalled();
    });

    it('GET /api/v1/treasury/venues/:venue requires no key', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/api/v1/treasury/venues/defindex-blend'),
      );
      expect(response.status).not.toBe(403);
    });

    it('GET /api/v1/treasury/history requires no key', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/api/v1/treasury/history'),
      );
      expect(response.status).not.toBe(403);
      expect(treasuryGetHistoryMock).toHaveBeenCalled();
    });
  });
});
