import type { PropertyInfo } from "@real-estate-defi/shared";
import type { PaginatedResponse } from "@/services/api/types";

/** Realistic mock wallet addresses (Stellar G... format) */
const OWNER_WALLET = "GAHTJRC3QXATJQLDPTBYVR27EPIVFQEZV2LJMJ32VE7QDMQBLUHVDUN";

export const mockProperties: PropertyInfo[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Lagos Island Luxury Residence",
    description:
      "A premium 4-bedroom penthouse in the heart of Lagos Island featuring stunning ocean views, modern finishes, and 24/7 security. Located within walking distance of Victoria Island's business district.",
    propertyType: "residential",
    location: {
      address: "15 Ozumba Mbadiwe Avenue",
      city: "Lagos",
      country: "Nigeria",
      postalCode: "101241",
      coordinates: { latitude: 6.4281, longitude: 3.4219 },
    },
    totalValue: "850000.00",
    tokenAddress: "GBTOKEN1LAGOSRESIDENCE000000000000000000000000000",
    totalShares: 10000,
    availableShares: 3250,
    pricePerShare: "85.00",
    images: [
      "https://images.unsplash.com/photo-1613977257592-4871e5fcd7c4?w=800",
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
    ],
    documents: [
      {
        id: "doc-001-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Property Title Deed",
        url: "https://example.com/docs/deed-001.pdf",
        uploadedAt: "2024-01-15T08:00:00.000Z",
        verified: true,
      },
      {
        id: "doc-001-uuid-0000-0000-000000000002",
        type: "appraisal",
        name: "Independent Appraisal Report 2024",
        url: "https://example.com/docs/appraisal-001.pdf",
        uploadedAt: "2024-02-10T08:00:00.000Z",
        verified: true,
      },
    ],
    verified: true,
    listedAt: "2024-03-01T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    name: "Nairobi Central Business Hub",
    description:
      "Grade A commercial office space in Nairobi's Upper Hill district. Fully let to blue-chip tenants with 5-year leases. AAA-rated building with LEED Gold certification, fiber-optic connectivity, and ample parking.",
    propertyType: "commercial",
    location: {
      address: "Upper Hill Road, Plot 21",
      city: "Nairobi",
      country: "Kenya",
      postalCode: "00100",
      coordinates: { latitude: -1.2921, longitude: 36.8219 },
    },
    totalValue: "2400000.00",
    tokenAddress: "GBTOKEN2NAIROBIOFFICEHUB000000000000000000000000",
    totalShares: 24000,
    availableShares: 8800,
    pricePerShare: "100.00",
    images: [
      "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800",
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
    ],
    documents: [
      {
        id: "doc-002-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Commercial Title Certificate",
        url: "https://example.com/docs/deed-002.pdf",
        uploadedAt: "2023-11-20T08:00:00.000Z",
        verified: true,
      },
      {
        id: "doc-002-uuid-0000-0000-000000000002",
        type: "inspection",
        name: "Structural Inspection Report",
        url: "https://example.com/docs/inspection-002.pdf",
        uploadedAt: "2023-12-05T08:00:00.000Z",
        verified: true,
      },
    ],
    verified: true,
    listedAt: "2024-01-10T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    name: "Accra Warehouse & Logistics Park",
    description:
      "Modern logistics facility spanning 12,000 sqm near Tema Port. Features 8m clear height, 20 dock levellers, and dedicated truck court. Strategically located for West Africa distribution networks.",
    propertyType: "industrial",
    location: {
      address: "Tema Industrial Area, Block 7",
      city: "Accra",
      country: "Ghana",
      postalCode: "GA-100",
      coordinates: { latitude: 5.6037, longitude: -0.187 },
    },
    totalValue: "1200000.00",
    totalShares: 12000,
    availableShares: 9600,
    pricePerShare: "100.00",
    images: [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800",
    ],
    documents: [
      {
        id: "doc-003-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Industrial Lease Certificate",
        url: "https://example.com/docs/deed-003.pdf",
        uploadedAt: "2024-04-01T08:00:00.000Z",
        verified: false,
      },
    ],
    verified: false,
    listedAt: "2024-04-15T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
  {
    id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    name: "Cape Town Waterfront Studio Units",
    description:
      "Portfolio of 6 serviced studio apartments in the V&A Waterfront precinct. Strong short-term rental yields due to tourism, with professional management in place. Breathtaking Table Mountain views.",
    propertyType: "residential",
    location: {
      address: "V&A Waterfront, Quay 5",
      city: "Cape Town",
      country: "South Africa",
      postalCode: "8001",
      coordinates: { latitude: -33.9065, longitude: 18.4235 },
    },
    totalValue: "1650000.00",
    tokenAddress: "GBTOKEN4CAPETOWNSTUDIO00000000000000000000000000",
    totalShares: 16500,
    availableShares: 2100,
    pricePerShare: "100.00",
    images: [
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800",
    ],
    documents: [
      {
        id: "doc-004-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Sectional Title Deed",
        url: "https://example.com/docs/deed-004.pdf",
        uploadedAt: "2023-09-12T08:00:00.000Z",
        verified: true,
      },
      {
        id: "doc-004-uuid-0000-0000-000000000002",
        type: "insurance",
        name: "Building Insurance Certificate",
        url: "https://example.com/docs/insurance-004.pdf",
        uploadedAt: "2024-01-01T08:00:00.000Z",
        verified: true,
      },
    ],
    verified: true,
    listedAt: "2023-10-05T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
  {
    id: "e5f6a7b8-c9d0-1234-efab-345678901234",
    name: "Kigali Mixed-Use Development",
    description:
      "Four-storey mixed-use building in Kigali's Kimihurura district. Ground floor retail, floors 2-4 residential. Brand new construction with 10-year structural warranty. Rwanda's fastest-growing residential corridor.",
    propertyType: "mixed",
    location: {
      address: "KG 5 Avenue, Plot 18",
      city: "Kigali",
      country: "Rwanda",
      postalCode: "KG 5",
      coordinates: { latitude: -1.9441, longitude: 30.0619 },
    },
    totalValue: "980000.00",
    totalShares: 9800,
    availableShares: 7200,
    pricePerShare: "100.00",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
    ],
    documents: [
      {
        id: "doc-005-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Certificate of Occupancy",
        url: "https://example.com/docs/deed-005.pdf",
        uploadedAt: "2024-05-01T08:00:00.000Z",
        verified: false,
      },
    ],
    verified: false,
    listedAt: "2024-05-20T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012345",
    name: "Dar es Salaam Beachfront Land",
    description:
      "2.4 hectares of prime beachfront land on Msasani Peninsula with approved planning permission for a 120-room boutique hotel or luxury residential development. One of the last available waterfront parcels.",
    propertyType: "land",
    location: {
      address: "Msasani Peninsula, Plot 44",
      city: "Dar es Salaam",
      country: "Tanzania",
      coordinates: { latitude: -6.7924, longitude: 39.2083 },
    },
    totalValue: "3200000.00",
    totalShares: 32000,
    availableShares: 29500,
    pricePerShare: "100.00",
    images: [
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800",
    ],
    documents: [
      {
        id: "doc-006-uuid-0000-0000-000000000001",
        type: "deed",
        name: "Land Title & Planning Permission",
        url: "https://example.com/docs/deed-006.pdf",
        uploadedAt: "2024-02-20T08:00:00.000Z",
        verified: true,
      },
    ],
    verified: true,
    listedAt: "2024-03-10T09:00:00.000Z",
    owner: OWNER_WALLET,
  },
];

export const mockPaginatedProperties: PaginatedResponse<PropertyInfo> = {
  data: mockProperties,
  pagination: {
    page: 1,
    limit: 10,
    total: mockProperties.length,
    totalPages: 1,
  },
};
