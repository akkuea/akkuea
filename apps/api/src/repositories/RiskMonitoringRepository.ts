import type { RiskStateTransition } from '@real-estate-defi/shared';

export class RiskMonitoringRepository {
  private transitions: RiskStateTransition[] = [];

  async saveTransition(transition: RiskStateTransition): Promise<void> {
    this.transitions.push(transition);
  }

  async getTransitionsByPosition(positionId: string): Promise<RiskStateTransition[]> {
    return this.transitions.filter((t) => t.positionId === positionId);
  }

  async getRecentTransitions(limit: number = 100): Promise<RiskStateTransition[]> {
    return this.transitions
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}
