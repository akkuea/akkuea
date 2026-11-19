import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { db } from '../db';
import { WhitelistService } from '../services/WhitelistService';
import { stellarService } from '../services/StellarService';
import { auditService } from '../services/AuditService';

describe('WhitelistService unit tests', () => {
  let whitelistService: WhitelistService;
  let mockRequest: any;

  beforeEach(() => {
    process.env.STELLAR_ADMIN_PUBLIC_KEY = 'GBU54MOHX7J3F2C2X4R56Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6';
    process.env.STELLAR_ADMIN_SECRET = 'SDTESTSECRETKEYFORADMINISTRATOR12345678901234567890123456';
    process.env.NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID = 'CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';

    whitelistService = new WhitelistService();

    mockRequest = {
      id: 'test-req-123',
      walletAddress: 'GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ',
      status: 'approved',
      fullName: 'John Doe',
      idType: 'passport',
      idReference: 'P123456',
    };

    mock.module('./AuditService', () => ({
      auditService: {
        logAction: mock(() => Promise.resolve()),
      },
    }));
  });

  afterEach(() => {
    mock.restore();
    delete process.env.STELLAR_ADMIN_PUBLIC_KEY;
    delete process.env.STELLAR_ADMIN_SECRET;
    delete process.env.NEXT_PUBLIC_PILOT_WHITELIST_CONTRACT_ID;
  });

  it('rejects revocation when reason is empty', async () => {
    expect(whitelistService.revokeRequest('test-req-123', '')).rejects.toThrow(
      'Revocation reason is required',
    );
    expect(whitelistService.revokeRequest('test-req-123', '   ')).rejects.toThrow(
      'Revocation reason is required',
    );
  });

  it('rejects revocation when request is not found', async () => {
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => undefined),
      },
    };

    expect(whitelistService.revokeRequest('nonexistent-id', 'test reason')).rejects.toThrow(
      'Whitelist request not found',
    );
  });

  it('rejects revocation when request is not in approved status', async () => {
    mockRequest.status = 'pending';
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => mockRequest),
      },
    };

    expect(whitelistService.revokeRequest('test-req-123', 'test reason')).rejects.toThrow(
      'Only approved requests can be revoked',
    );
  });

  it('fails closed and keeps DB unchanged if on-chain revoke fails', async () => {
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => mockRequest),
      },
    };

    const updateMock = mock(() => ({
      set: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    }));
    (db as any).update = updateMock;

    stellarService.submitWhitelistRevoke = mock(async () => {
      throw new Error('Soroban contract call failed: simulation rejected');
    });

    expect(whitelistService.revokeRequest('test-req-123', 'AML flag')).rejects.toThrow(
      'simulation rejected',
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('submits on-chain revoke, updates database, and logs audit action with actor', async () => {
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => mockRequest),
      },
    };

    const updatedRecord = {
      ...mockRequest,
      status: 'revoked',
      rejectionReason: 'Sanctions list match',
      reviewedAt: new Date(),
    };

    const returningMock = mock(async () => [updatedRecord]);
    const whereMock = mock(() => ({ returning: returningMock }));
    const setMock = mock(() => ({ where: whereMock }));
    const updateMock = mock(() => ({ set: setMock }));
    (db as any).update = updateMock;

    stellarService.submitWhitelistRevoke = mock(async () => 'mock_tx_revoke_success');
    auditService.logAction = mock(async () => {});

    const operatorWallet = 'GOPERATOR111111111111111111111111111111111111111111111111';
    const txHash = await whitelistService.revokeRequest(
      'test-req-123',
      'Sanctions list match',
      operatorWallet,
    );

    expect(txHash).toBe('mock_tx_revoke_success');
    expect(stellarService.submitWhitelistRevoke).toHaveBeenCalledWith(
      'CAOIML5WZYESSX5CPRFHA2OY7UXVW2ISJLL362OVX7MY3G7CMRWN3QA4',
      process.env.STELLAR_ADMIN_PUBLIC_KEY!,
      process.env.STELLAR_ADMIN_SECRET!,
      mockRequest.walletAddress,
    );

    expect(auditService.logAction).toHaveBeenCalledWith({
      actor: operatorWallet,
      action: 'whitelist.revoke',
      entityType: 'pilot_whitelist_request',
      entityId: 'test-req-123',
      beforeValue: mockRequest,
      afterValue: updatedRecord,
      metadata: {
        walletAddress: mockRequest.walletAddress,
        reason: 'Sanctions list match',
        txHash: 'mock_tx_revoke_success',
      },
    });
  });
});
