import type { PropertyInfo } from '@real-estate-defi/shared';
import type { CreatePropertyDto, UpdatePropertyDto, PropertyFilterDto } from '../dto/property.dto';
import { matchesFilter } from '../dto/property.dto';

export class PropertyRepository {
  private properties: Map<string, PropertyInfo> = new Map();
  private idCounter = 1;

  constructor() {
    this.seedData();
  }

  getAll(filter?: PropertyFilterDto): PropertyInfo[] {
    let properties = Array.from(this.properties.values());

    if (filter) {
      properties = properties.filter((property) => matchesFilter(property, filter));
    }

    return properties;
  }

  getById(id: string): PropertyInfo | undefined {
    return this.properties.get(id);
  }

  create(data: CreatePropertyDto): PropertyInfo {
    const id = `property_${this.idCounter++}`;
    
    const property: PropertyInfo = {
      id,
      owner: data.owner,
      totalShares: data.totalShares,
      availableShares: data.totalShares,
      valuePerShare: data.valuePerShare,
      metadata: data.metadata,
      location: data.location,
      documents: data.documents,
    };

    this.properties.set(id, property);
    return property;
  }

  update(id: string, data: UpdatePropertyDto): PropertyInfo | undefined {
    const existingProperty = this.properties.get(id);
    
    if (!existingProperty) {
      return undefined;
    }

    const updatedProperty: PropertyInfo = {
      ...existingProperty,
      ...(data.owner !== undefined && { owner: data.owner }),
      ...(data.totalShares !== undefined && { totalShares: data.totalShares }),
      ...(data.availableShares !== undefined && { availableShares: data.availableShares }),
      ...(data.valuePerShare !== undefined && { valuePerShare: data.valuePerShare }),
      ...(data.metadata !== undefined && { metadata: { ...existingProperty.metadata, ...data.metadata } }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.documents !== undefined && { documents: data.documents }),
    };

    this.properties.set(id, updatedProperty);
    return updatedProperty;
  }

  delete(id: string): boolean {
    return this.properties.delete(id);
  }

  exists(id: string): boolean {
    return this.properties.has(id);
  }

  count(filter?: PropertyFilterDto): number {
    return this.getAll(filter).length;
  }

  getPaginated(
    page: number,
    limit: number,
    filter?: PropertyFilterDto,
  ): { properties: PropertyInfo[]; total: number } {
    const allProperties = this.getAll(filter);
    const total = allProperties.length;
    const offset = (page - 1) * limit;
    const properties = allProperties.slice(offset, offset + limit);

    return { properties, total };
  }

  private seedData(): void {
    const seedProperties: CreatePropertyDto[] = [
      {
        owner: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        totalShares: 1000,
        valuePerShare: 100,
        metadata: {
          name: 'Luxury Villa in Miami',
          description: 'Beautiful beachfront property with ocean views',
          propertyType: 'residential',
          yearBuilt: '2020',
          squareFeet: '5000',
        },
        location: {
          address: '123 Ocean Drive',
          city: 'Miami',
          country: 'USA',
          coordinates: {
            lat: 25.7617,
            lng: -80.1918,
          },
        },
        documents: [
          {
            title: 'Property Deed',
            url: 'https://example.com/deed1.pdf',
            type: 'deed',
          },
          {
            title: 'Property Appraisal',
            url: 'https://example.com/appraisal1.pdf',
            type: 'appraisal',
          },
        ],
      },
      {
        owner: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
        totalShares: 500,
        valuePerShare: 200,
        metadata: {
          name: 'Downtown Office Building',
          description: 'Modern office space in the heart of the city',
          propertyType: 'commercial',
          yearBuilt: '2018',
          squareFeet: '10000',
        },
        location: {
          address: '456 Main Street',
          city: 'New York',
          country: 'USA',
          coordinates: {
            lat: 40.7128,
            lng: -74.006,
          },
        },
        documents: [
          {
            title: 'Property Deed',
            url: 'https://example.com/deed2.pdf',
            type: 'deed',
          },
        ],
      },
      {
        owner: 'GZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
        totalShares: 750,
        valuePerShare: 150,
        metadata: {
          name: 'Mountain Retreat',
          description: 'Secluded cabin with stunning mountain views',
          propertyType: 'residential',
          yearBuilt: '2019',
          squareFeet: '3000',
        },
        location: {
          address: '789 Mountain Road',
          city: 'Denver',
          country: 'USA',
          coordinates: {
            lat: 39.7392,
            lng: -104.9903,
          },
        },
        documents: [
          {
            title: 'Property Deed',
            url: 'https://example.com/deed3.pdf',
            type: 'deed',
          },
          {
            title: 'Property Inspection',
            url: 'https://example.com/inspection3.pdf',
            type: 'inspection',
          },
        ],
      },
    ];

    seedProperties.forEach((propertyData) => {
      this.create(propertyData);
    });
  }
}

export const propertyRepository = new PropertyRepository();