import type { PropertyInfo } from '@real-estate-defi/shared';

/**
 * DTO for creating a new property
 */
export interface CreatePropertyDto {
  owner: string;
  totalShares: number;
  valuePerShare: number;
  metadata: Record<string, string>;
  location?: {
    address: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  documents?: {
    title: string;
    url: string;
    type: "deed" | "appraisal" | "inspection" | "other";
  }[];
}

/**
 * DTO for updating an existing property
 */
export interface UpdatePropertyDto {
  owner?: string;
  totalShares?: number;
  availableShares?: number;
  valuePerShare?: number;
  metadata?: Record<string, string>;
  location?: {
    address: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  documents?: {
    title: string;
    url: string;
    type: "deed" | "appraisal" | "inspection" | "other";
  }[];
}

/**
 * DTO for filtering properties
 */
export interface PropertyFilterDto {
  owner?: string;
  city?: string;
  country?: string;
  minValuePerShare?: number;
  maxValuePerShare?: number;
  minAvailableShares?: number;
  hasAvailableShares?: boolean;
}

/**
 * DTO for pagination parameters
 */
export interface PaginationDto {
  page: number;
  limit: number;
}

/**
 * DTO for paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Validates a CreatePropertyDto
 */
export function validateCreateProperty(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid request body');
    return { valid: false, errors };
  }

  const dto = data as Partial<CreatePropertyDto>;

  // Required fields
  if (!dto.owner || typeof dto.owner !== 'string' || dto.owner.trim().length === 0) {
    errors.push('Owner is required and must be a non-empty string');
  }

  if (typeof dto.totalShares !== 'number' || dto.totalShares <= 0) {
    errors.push('Total shares must be a positive number');
  }

  if (typeof dto.valuePerShare !== 'number' || dto.valuePerShare <= 0) {
    errors.push('Value per share must be a positive number');
  }

  if (!dto.metadata || typeof dto.metadata !== 'object') {
    errors.push('Metadata is required and must be an object');
  }

  // Optional location validation
  if (dto.location) {
    if (!dto.location.address || typeof dto.location.address !== 'string') {
      errors.push('Location address must be a string');
    }
    if (!dto.location.city || typeof dto.location.city !== 'string') {
      errors.push('Location city must be a string');
    }
    if (!dto.location.country || typeof dto.location.country !== 'string') {
      errors.push('Location country must be a string');
    }
    if (dto.location.coordinates) {
      if (typeof dto.location.coordinates.lat !== 'number' || 
          dto.location.coordinates.lat < -90 || 
          dto.location.coordinates.lat > 90) {
        errors.push('Location coordinates latitude must be between -90 and 90');
      }
      if (typeof dto.location.coordinates.lng !== 'number' || 
          dto.location.coordinates.lng < -180 || 
          dto.location.coordinates.lng > 180) {
        errors.push('Location coordinates longitude must be between -180 and 180');
      }
    }
  }

  // Optional documents validation
  if (dto.documents) {
    if (!Array.isArray(dto.documents)) {
      errors.push('Documents must be an array');
    } else {
      dto.documents.forEach((doc, index) => {
        if (!doc.title || typeof doc.title !== 'string') {
          errors.push(`Document ${index}: title is required and must be a string`);
        }
        if (!doc.url || typeof doc.url !== 'string') {
          errors.push(`Document ${index}: url is required and must be a string`);
        }
        if (!['deed', 'appraisal', 'inspection', 'other'].includes(doc.type)) {
          errors.push(`Document ${index}: type must be one of: deed, appraisal, inspection, other`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates an UpdatePropertyDto
 */
export function validateUpdateProperty(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    errors.push('Invalid request body');
    return { valid: false, errors };
  }

  const dto = data as Partial<UpdatePropertyDto>;

  // At least one field must be provided
  if (Object.keys(dto).length === 0) {
    errors.push('At least one field must be provided for update');
    return { valid: false, errors };
  }

  // Validate fields if provided
  if (dto.owner !== undefined && (typeof dto.owner !== 'string' || dto.owner.trim().length === 0)) {
    errors.push('Owner must be a non-empty string');
  }

  if (dto.totalShares !== undefined && (typeof dto.totalShares !== 'number' || dto.totalShares <= 0)) {
    errors.push('Total shares must be a positive number');
  }

  if (dto.availableShares !== undefined && (typeof dto.availableShares !== 'number' || dto.availableShares < 0)) {
    errors.push('Available shares must be a non-negative number');
  }

  if (dto.valuePerShare !== undefined && (typeof dto.valuePerShare !== 'number' || dto.valuePerShare <= 0)) {
    errors.push('Value per share must be a positive number');
  }

  if (dto.metadata !== undefined && typeof dto.metadata !== 'object') {
    errors.push('Metadata must be an object');
  }

  // Optional location validation
  if (dto.location) {
    if (dto.location.address && typeof dto.location.address !== 'string') {
      errors.push('Location address must be a string');
    }
    if (dto.location.city && typeof dto.location.city !== 'string') {
      errors.push('Location city must be a string');
    }
    if (dto.location.country && typeof dto.location.country !== 'string') {
      errors.push('Location country must be a string');
    }
    if (dto.location.coordinates) {
      if (typeof dto.location.coordinates.lat !== 'number' || 
          dto.location.coordinates.lat < -90 || 
          dto.location.coordinates.lat > 90) {
        errors.push('Location coordinates latitude must be between -90 and 90');
      }
      if (typeof dto.location.coordinates.lng !== 'number' || 
          dto.location.coordinates.lng < -180 || 
          dto.location.coordinates.lng > 180) {
        errors.push('Location coordinates longitude must be between -180 and 180');
      }
    }
  }

  // Optional documents validation
  if (dto.documents) {
    if (!Array.isArray(dto.documents)) {
      errors.push('Documents must be an array');
    } else {
      dto.documents.forEach((doc, index) => {
        if (!doc.title || typeof doc.title !== 'string') {
          errors.push(`Document ${index}: title is required and must be a string`);
        }
        if (!doc.url || typeof doc.url !== 'string') {
          errors.push(`Document ${index}: url is required and must be a string`);
        }
        if (!['deed', 'appraisal', 'inspection', 'other'].includes(doc.type)) {
          errors.push(`Document ${index}: type must be one of: deed, appraisal, inspection, other`);
        }
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates pagination parameters
 */
export function validatePagination(page: unknown, limit: unknown): PaginationDto {
  const pageNum = typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 10;

  return {
    page: pageNum > 0 ? pageNum : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 10,
  };
}

/**
 * Applies filters to a property
 */
export function matchesFilter(property: PropertyInfo, filter: PropertyFilterDto): boolean {
  if (filter.owner && property.owner !== filter.owner) {
    return false;
  }

  if (filter.city && property.location?.city !== filter.city) {
    return false;
  }

  if (filter.country && property.location?.country !== filter.country) {
    return false;
  }

  if (filter.minValuePerShare !== undefined && property.valuePerShare < filter.minValuePerShare) {
    return false;
  }

  if (filter.maxValuePerShare !== undefined && property.valuePerShare > filter.maxValuePerShare) {
    return false;
  }

  if (filter.minAvailableShares !== undefined && property.availableShares < filter.minAvailableShares) {
    return false;
  }

  if (filter.hasAvailableShares && property.availableShares <= 0) {
    return false;
  }

  return true;
}
