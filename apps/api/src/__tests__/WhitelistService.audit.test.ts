/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for WhitelistService audit trail.
 * Verifies that auditService.logAction is called with the correct fields when
 * approving or rejecting a whitelist request.
 */
import { describe, expect, it, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test.
// Bun's mock.module uses the same top-level-await/static-import constraint as
// Jest's jest.mock: declarations are hoisted before imports.
// ---------------------------------------------------------------------------

const mockLogAction = mock(() => Promise.resolve());

mock.module('../services/AuditService', () => ({
  auditService: { logAction: mockLogAction },
}));

mock.module('../services/StellarService', () => ({
  stellarService: {
    submitWhitelistApprove: mock(() => Promise.resolve('mock_tx_hash_unit')),
  },
}));

mock.module('../config/contracts', () => ({
  getPilotWhitelistContractId: () => 'mock_contract_id_unit',
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATOR_WALLET = 'GOPERATOR_WALLET_12345678901234567890123456789012345678901';
const MOCK_WALLET = 'GINVESTOR_WALLET_12345678901234567890123456789012345678901';
const REQUEST_UUID = '550e8400-e29b-41d4-a716-446655440099';

// ---------------------------------------------------------------------------
// db mock — re-applied in beforeEach so each test starts clean.
// ---------------------------------------------------------------------------

import { db } from '../db';

const pendingRequest = {
  id: REQUEST_UUID,
  walletAddress: MOCK_WALLET,
  status: 'pending' as const,
  rejectionReason: null,
  reviewedAt: null,
};

function wirePendingRequestMock() {
  (db as any).query = {
    pilotWhitelistRequests: {
      findFirst: mock(() => Promise.resolve(pendingRequest)),
    },
  };
  (db as any).update = mock(() => ({
    set: () => ({ where: () => Promise.resolve() }),
  }));
}

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are declared.
// ---------------------------------------------------------------------------

import { WhitelistService } from '../services/WhitelistService';

process.env.STELLAR_ADMIN_PUBLIC_KEY = 'GADMIN_PUBLIC_KEY_PLACEHOLDER_00000000000000000000000';
process.env.STELLAR_ADMIN_SECRET = 'SADMIN_SECRET_PLACEHOLDER';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhitelistService audit trail', () => {
  beforeEach(() => {
    mockLogAction.mockClear();
    wirePendingRequestMock();
  });

  describe('approveRequest', () => {
    it('calls auditService.logAction after DB update', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      expect(mockLogAction).toHaveBeenCalledTimes(1);
    });

    it('passes the correct actor (operator wallet)', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.actor).toBe(OPERATOR_WALLET);
    });

    it('uses action "whitelist.approve"', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.action).toBe('whitelist.approve');
    });

    it('sets entityType to "pilot_whitelist_request"', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.entityType).toBe('pilot_whitelist_request');
    });

    it('sets entityId to the request UUID', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.entityId).toBe(REQUEST_UUID);
    });

    it('records before status as "pending"', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.beforeValue?.status).toBe('pending');
    });

    it('records after status as "approved"', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.afterValue?.status).toBe('approved');
    });

    it('includes walletAddress and txHash in metadata', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.metadata?.walletAddress).toBe(MOCK_WALLET);
      expect(call.metadata?.txHash).toBe('mock_tx_hash_unit');
    });

    it('defaults actor to "system" when actorWallet is omitted', async () => {
      const svc = new WhitelistService();
      await svc.approveRequest(REQUEST_UUID);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.actor).toBe('system');
    });
  });

  describe('rejectRequest', () => {
    const REJECTION_REASON = 'Identity document not legible';

    it('calls auditService.logAction after DB update', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      expect(mockLogAction).toHaveBeenCalledTimes(1);
    });

    it('passes the correct actor (operator wallet)', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.actor).toBe(OPERATOR_WALLET);
    });

    it('uses action "whitelist.reject"', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.action).toBe('whitelist.reject');
    });

    it('sets entityType to "pilot_whitelist_request"', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.entityType).toBe('pilot_whitelist_request');
    });

    it('records before status as "pending"', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.beforeValue?.status).toBe('pending');
    });

    it('records after status as "rejected"', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.afterValue?.status).toBe('rejected');
    });

    it('records rejection reason in afterValue', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.afterValue?.rejectionReason).toBe(REJECTION_REASON);
    });

    it('includes walletAddress and reason in metadata', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON, OPERATOR_WALLET);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.metadata?.walletAddress).toBe(MOCK_WALLET);
      expect(call.metadata?.reason).toBe(REJECTION_REASON);
    });

    it('defaults actor to "system" when actorWallet is omitted', async () => {
      const svc = new WhitelistService();
      await svc.rejectRequest(REQUEST_UUID, REJECTION_REASON);

      const call = mockLogAction.mock.calls[0]![0] as any;
      expect(call.actor).toBe('system');
    });
  });
});
