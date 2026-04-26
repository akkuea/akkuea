import { ApiError } from '../errors/ApiError';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { logger } from './logger';
import { stellarService } from './StellarService';

export interface TokenizationResponse {
  txHash: string;
  contractId: string;
  sorobanPropertyId: string;
  tokenAddress: string;
  totalShares: number;
  owner: string;
}

interface TokenizationDependencies {
  propertyRepository: typeof propertyRepository;
  userRepository: typeof userRepository;
  stellarService: typeof stellarService;
}

export class TokenizationService {
  constructor(
    private readonly dependencies: TokenizationDependencies = {
      propertyRepository,
      userRepository,
      stellarService,
    },
  ) {}

  async tokenizeProperty(propertyId: string, userAddress?: string): Promise<TokenizationResponse> {
    if (!userAddress) {
      throw new ApiError(401, 'UNAUTHORIZED', 'User address is required for authentication');
    }

    const property = await this.dependencies.propertyRepository.findById(propertyId);
    if (!property) {
      throw ApiError.notFound(`Property with id ${propertyId} not found`);
    }

    if (!property.verified) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Property must be verified before tokenization');
    }

    if (property.tokenAddress || property.sorobanPropertyId !== null) {
      throw ApiError.conflict('Property has already been tokenized');
    }

    const owner = await this.dependencies.userRepository.findById(property.ownerId);
    if (!owner) {
      throw ApiError.internal(`Property owner for ${propertyId} could not be resolved`);
    }

    const { contractId, adminPublicKey, adminSecret } =
      this.dependencies.stellarService.getMintingConfig();

    if (owner.walletAddress !== userAddress && adminPublicKey !== userAddress) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not have permission to tokenize this property');
    }

    const sorobanPropertyId =
      await this.dependencies.propertyRepository.allocateSorobanPropertyId();

    logger.info('Property tokenization started', {
      event: 'tokenization_started',
      operation: 'TOKENIZE',
      entity: 'property',
      entityId: propertyId,
      userId: userAddress,
      contractId,
      sorobanPropertyId,
    });

    let txHash: string;

    try {
      const result = await this.dependencies.stellarService.mintPropertyShares({
        contractId,
        adminPublicKey,
        adminSecret,
        sorobanPropertyId,
        recipient: owner.walletAddress,
        amount: property.totalShares,
      });
      txHash = result.txHash;
    } catch (error) {
      logger.error('Property tokenization failed', error, {
        event: 'tokenization_failed',
        operation: 'TOKENIZE',
        entity: 'property',
        entityId: propertyId,
        userId: userAddress,
        contractId,
        sorobanPropertyId,
      });
      throw error;
    }

    const updatedProperty = await this.dependencies.propertyRepository.setTokenizationResult(
      propertyId,
      {
        tokenAddress: contractId,
        sorobanPropertyId,
      },
    );

    if (!updatedProperty) {
      throw ApiError.internal('Tokenization succeeded on-chain, but property update failed');
    }

    if (
      updatedProperty.tokenAddress !== contractId ||
      updatedProperty.sorobanPropertyId !== sorobanPropertyId
    ) {
      logger.error('Property tokenization reconciliation required', {
        event: 'tokenization_reconciliation_required',
        operation: 'TOKENIZE',
        entity: 'property',
        entityId: propertyId,
        userId: userAddress,
        txHash,
        contractId,
        sorobanPropertyId,
      });
      throw ApiError.internal(
        'Tokenization succeeded on-chain, but the property was already updated concurrently',
      );
    }

    logger.info('Property tokenization succeeded', {
      event: 'tokenization_succeeded',
      operation: 'TOKENIZE',
      entity: 'property',
      entityId: propertyId,
      userId: userAddress,
      txHash,
      contractId,
      sorobanPropertyId,
    });

    return {
      txHash,
      contractId,
      sorobanPropertyId: String(sorobanPropertyId),
      tokenAddress: updatedProperty.tokenAddress!,
      totalShares: updatedProperty.totalShares,
      owner: owner.walletAddress,
    };
  }
}

export const tokenizationService = new TokenizationService();
