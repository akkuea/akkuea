import { isTreasuryVenueId, type TreasuryVenueId } from '../config/treasury';
import { ApiError } from '../errors/ApiError';
import { treasuryService, type TreasuryService } from '../services/TreasuryService';

export interface TreasuryMovementBody {
  venue: string;
  amount: number;
  slippageBps?: number;
  requestedBy?: string;
}

export class TreasuryController {
  constructor(private readonly service: TreasuryService = treasuryService) {}

  async getPortfolio() {
    return this.service.getPortfolio();
  }

  async getPosition(venue: string) {
    return this.service.getPosition(this.parseVenue(venue));
  }

  async getHistory(params: { venue?: string; limit: number; offset: number }) {
    return this.service.getHistory({
      venue: params.venue ? this.parseVenue(params.venue) : undefined,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async deposit(body: TreasuryMovementBody, actor: string) {
    return this.service.deposit({
      venue: this.parseVenue(body.venue),
      amount: body.amount,
      slippageBps: body.slippageBps,
      requestedBy: body.requestedBy ?? actor,
    });
  }

  async withdraw(body: TreasuryMovementBody, actor: string) {
    return this.service.withdraw({
      venue: this.parseVenue(body.venue),
      amount: body.amount,
      slippageBps: body.slippageBps,
      requestedBy: body.requestedBy ?? actor,
    });
  }

  private parseVenue(venue: string): TreasuryVenueId {
    if (!isTreasuryVenueId(venue)) {
      throw ApiError.notFound(`Unknown treasury venue '${venue}'`);
    }
    return venue;
  }
}

export const treasuryController = new TreasuryController();
