import { describe, test, expect, beforeEach } from 'bun:test';
import { RiskMonitoringRepository } from '../repositories/RiskMonitoringRepository';
import type { RiskStateTransition } from '@real-estate-defi/shared';

describe('RiskMonitoringRepository', () => {
  let repository: RiskMonitoringRepository;

  beforeEach(() => {
    repository = new RiskMonitoringRepository();
  });

  test('Threshold transitions are persisted', async () => {
    const transition: RiskStateTransition = {
      id: 'trans-1',
      positionId: 'pos-1',
      fromRiskLevel: 'safe',
      toRiskLevel: 'warning',
      healthFactor: 1.2,
      timestamp: new Date(),
      reason: 'Health factor dropped',
    };

    await repository.saveTransition(transition);
    const transitions = await repository.getTransitionsByPosition('pos-1');

    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.id).toBe('trans-1');
    expect(transitions[0]?.fromRiskLevel).toBe('safe');
    expect(transitions[0]?.toRiskLevel).toBe('warning');
  });

  test('Multiple transitions for same position', async () => {
    const transitions: RiskStateTransition[] = [
      {
        id: 'trans-1',
        positionId: 'pos-1',
        fromRiskLevel: 'safe',
        toRiskLevel: 'warning',
        healthFactor: 1.2,
        timestamp: new Date(),
        reason: 'First drop',
      },
      {
        id: 'trans-2',
        positionId: 'pos-1',
        fromRiskLevel: 'warning',
        toRiskLevel: 'critical',
        healthFactor: 1.05,
        timestamp: new Date(),
        reason: 'Second drop',
      },
    ];

    for (const t of transitions) {
      await repository.saveTransition(t);
    }

    const result = await repository.getTransitionsByPosition('pos-1');
    expect(result).toHaveLength(2);
  });

  test('Get recent transitions with limit', async () => {
    for (let i = 0; i < 150; i++) {
      await repository.saveTransition({
        id: `trans-${i}`,
        positionId: `pos-${i}`,
        fromRiskLevel: 'safe',
        toRiskLevel: 'warning',
        healthFactor: 1.2,
        timestamp: new Date(Date.now() + i * 1000),
        reason: 'Test',
      });
    }

    const recent = await repository.getRecentTransitions(50);
    expect(recent).toHaveLength(50);
  });
});
