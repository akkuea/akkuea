import type {
  OperationalPropertyListItem,
  OperationalPropertyDetail,
} from "@/services/api/adminOperations";
import { mockProperties } from "./properties";

export const mockAdminQueue: OperationalPropertyListItem[] = [
  {
    id: mockProperties[2].id, // Accra Warehouse - not verified
    name: mockProperties[2].name,
    propertyType: "industrial",
    city: "Accra",
    country: "Ghana",
    reviewStatus: "pending_review",
    verified: false,
    ownerWallet: mockProperties[2].owner,
    ownerKycStatus: "approved",
    ownerKycTier: "verified",
    tokenized: false,
    sorobanPropertyId: null,
    valuationState: "active",
    documentCount: 1,
    readiness: {
      kycApproved: true,
      valuationActive: true,
      hasTokenAddress: false,
    },
    lastReviewedAt: null,
    lastReviewerWallet: null,
    lastReviewNote: null,
    listedAt: mockProperties[2].listedAt,
  },
  {
    id: mockProperties[4].id, // Kigali - not verified
    name: mockProperties[4].name,
    propertyType: "mixed",
    city: "Kigali",
    country: "Rwanda",
    reviewStatus: "changes_requested",
    verified: false,
    ownerWallet: mockProperties[4].owner,
    ownerKycStatus: "pending",
    ownerKycTier: "basic",
    tokenized: false,
    sorobanPropertyId: null,
    valuationState: "stale",
    documentCount: 1,
    readiness: {
      kycApproved: false,
      valuationActive: false,
      hasTokenAddress: false,
    },
    lastReviewedAt: "2024-05-25T10:00:00.000Z",
    lastReviewerWallet: "GADMINREVIEWER000000000000000000000000000000000000000",
    lastReviewNote:
      "KYC tier insufficient. Please resubmit with full verification.",
    listedAt: mockProperties[4].listedAt,
  },
];

export const mockAdminPropertyDetail: OperationalPropertyDetail = {
  ...mockProperties[2],
  reviewStatus: "pending_review",
  lastReviewedAt: null,
  lastReviewerWallet: null,
  lastReviewNote: null,
  ownerKycStatus: "approved",
  ownerKycTier: "verified",
  valuation: {
    state: "active",
    record: {
      id: "val-rec-001-uuid-00000000000001",
      propertyId: mockProperties[2].id,
      price: 1200000,
      currency: "USD",
      sourceId: "src-jll-001",
      sourceName: "JLL Africa Valuations",
      timestamp: new Date("2024-04-10T00:00:00.000Z"),
      confidence: 91,
      methodology: "income_approach",
      provenance: {
        dataProvider: "JLL Africa",
        reportUrl: "https://example.com/valuations/jll-accra-001.pdf",
        assessorName: "Kwame Mensah, MRICS",
      },
      metadata: {
        squareFootage: 12000,
        propertyType: "industrial",
        neighborhood: "Tema Industrial Area",
      },
      status: "active",
      receivedAt: new Date("2024-04-10T14:00:00.000Z"),
    },
  },
  audit: {
    lastActionAt: null,
    lastActorWallet: null,
    lastNote: null,
  },
};
