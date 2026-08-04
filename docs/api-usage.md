# Akkuea Real Estate DeFi API Documentation

## Table of Contents

1. [Base URL & Authentication](#base-url--authentication)
2. [Authentication Guide](#authentication-guide)
3. [Error Handling](#error-handling)
4. [Auth Endpoints](#auth-endpoints)
5. [Properties Endpoints](#properties-endpoints)
6. [Lending Endpoints](#lending-endpoints)
7. [KYC Endpoints](#kyc-endpoints)
8. [Notifications Endpoints](#notifications-endpoints)
9. [Admin Endpoints](#admin-endpoints)
10. [Response Examples](#response-examples)
11. [Rate Limiting](#rate-limiting)
12. [Versioning](#versioning)

---

## Base URL & Authentication

**Base URL:**

```
http://localhost:3001  (Development)
https://api.akkuea.com (Production)
```

**API Version:** 1.0.0

**Authentication Type:** Bearer Token (JWT)

**Swagger Documentation:**

```
http://localhost:3001/swagger
```

---

## Authentication Guide

### Overview

The Akkuea API uses Stellar wallet authentication with JWT tokens. Users authenticate by:

1. Requesting a challenge nonce using their Stellar address
2. Signing the challenge with their Stellar private key
3. Exchanging the signed message for a JWT token
4. Using the JWT token in the `Authorization` header for all protected endpoints

### Stellar Address Format

Stellar addresses are 56 characters long and start with `G`:

```
Example: GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE
```

### Bearer Token Usage

All protected endpoints require the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" https://api.akkuea.com/properties
```

---

## Error Handling

### Error Response Format

All errors return a JSON response with the following structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 401,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

### Common Error Codes

| Code             | Status | Description                            |
| ---------------- | ------ | -------------------------------------- |
| `UNAUTHORIZED`   | 401    | Missing, invalid, or expired JWT token |
| `FORBIDDEN`      | 403    | User lacks required permissions        |
| `BAD_REQUEST`    | 400    | Invalid request parameters or body     |
| `NOT_FOUND`      | 404    | Resource not found                     |
| `INTERNAL_ERROR` | 500    | Server-side error                      |

### Common Error Scenarios

**Missing Authentication Token:**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authorization header is missing or invalid",
  "statusCode": 401,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

**Invalid Parameters:**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "Invalid property ID format",
  "statusCode": 400,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

**Resource Not Found:**

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Property not found",
  "statusCode": 404,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

---

## Auth Endpoints

### 1. Get Challenge

Request a nonce to sign for authentication.

**Endpoint:** `POST /auth/challenge`

**Authentication:** None (public)

**Request Body:**

```json
{
  "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "challenge": "Your unique nonce to sign",
  "expiresAt": "2026-06-29T10:45:00.000Z"
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
  }'
```

### 2. Verify Session

Exchange signed challenge for JWT token.

**Endpoint:** `POST /auth/session`

**Authentication:** None (public)

**Request Body:**

```json
{
  "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
  "signature": "signed_challenge_from_wallet"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "userAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
}
```

**Error Response (401):**

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Invalid signature",
  "statusCode": 401,
  "timestamp": "2026-06-29T10:30:00.000Z"
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "signature": "your_signed_challenge"
  }'
```

---

## Properties Endpoints

### 1. List Properties

Retrieve paginated list of properties with optional filters.

**Endpoint:** `GET /properties`

**Authentication:** None (public)

**Query Parameters:**

| Parameter      | Type    | Description                                              |
| -------------- | ------- | -------------------------------------------------------- |
| `limit`        | number  | Results per page (default: 10)                           |
| `offset`       | number  | Pagination offset (default: 0)                           |
| `propertyType` | string  | Filter: residential, commercial, industrial, land, mixed |
| `country`      | string  | Filter by country                                        |
| `minPrice`     | number  | Minimum property value                                   |
| `maxPrice`     | number  | Maximum property value                                   |
| `verified`     | boolean | Filter by verification status                            |
| `owner`        | string  | Filter by owner's Stellar address                        |

**Success Response (200):**

```json
{
  "success": true,
  "properties": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Downtown Apartment Complex",
      "description": "Modern 50-unit residential complex",
      "propertyType": "residential",
      "location": {
        "address": "123 Main Street",
        "city": "San Francisco",
        "country": "USA",
        "postalCode": "94102"
      },
      "totalValue": "5000000.00",
      "totalShares": 1000,
      "pricePerShare": "5000.00",
      "availableShares": 750,
      "images": ["https://example.com/image1.jpg"],
      "owner": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
      "verified": true,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-06-29T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**cURL Example:**

```bash
curl "https://api.akkuea.com/properties?propertyType=residential&country=USA&limit=10&offset=0"
```

### 2. Get Single Property

Retrieve details of a specific property.

**Endpoint:** `GET /properties/:id`

**Authentication:** None (public)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Property ID |

**Success Response (200):**

```json
{
  "success": true,
  "property": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Downtown Apartment Complex",
    "description": "Modern 50-unit residential complex in prime location",
    "propertyType": "residential",
    "location": {
      "address": "123 Main Street",
      "city": "San Francisco",
      "country": "USA",
      "postalCode": "94102"
    },
    "totalValue": "5000000.00",
    "totalShares": 1000,
    "pricePerShare": "5000.00",
    "availableShares": 750,
    "images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "owner": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "verified": true,
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-06-29T10:00:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/properties/550e8400-e29b-41d4-a716-446655440000
```

### 3. Create Property

Create a new tokenized property listing.

**Endpoint:** `POST /properties`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "name": "Downtown Apartment Complex",
  "description": "Modern 50-unit residential complex in prime location",
  "propertyType": "residential",
  "location": {
    "address": "123 Main Street",
    "city": "San Francisco",
    "country": "USA",
    "postalCode": "94102"
  },
  "totalValue": "5000000.00",
  "totalShares": 1000,
  "pricePerShare": "5000.00",
  "images": ["https://example.com/image1.jpg"]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "property": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Downtown Apartment Complex",
    "owner": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "totalValue": "5000000.00",
    "totalShares": 1000,
    "availableShares": 1000,
    "verified": false,
    "createdAt": "2026-06-29T10:30:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/properties \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Downtown Apartment Complex",
    "description": "Modern 50-unit residential complex in prime location",
    "propertyType": "residential",
    "location": {
      "address": "123 Main Street",
      "city": "San Francisco",
      "country": "USA",
      "postalCode": "94102"
    },
    "totalValue": "5000000.00",
    "totalShares": 1000,
    "pricePerShare": "5000.00",
    "images": ["https://example.com/image1.jpg"]
  }'
```

### 4. Buy Property Shares

Purchase shares of a tokenized property.

**Endpoint:** `POST /properties/:id/buy-shares`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Property ID |

**Request Body:**

```json
{
  "buyer": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
  "shares": 50
}
```

**Success Response (200):**

```json
{
  "success": true,
  "transaction": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "propertyId": "550e8400-e29b-41d4-a716-446655440000",
    "buyer": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "shares": 50,
    "totalCost": "250000.00",
    "transactionHash": "1234567890abcdef",
    "status": "completed",
    "completedAt": "2026-06-29T10:35:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/properties/550e8400-e29b-41d4-a716-446655440000/buy-shares \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buyer": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "shares": 50
  }'
```

### 5. Get User Shares

Check how many shares a user owns in a property.

**Endpoint:** `GET /properties/:id/shares/:owner`

**Authentication:** None (public)

**URL Parameters:**

| Parameter | Type          | Description             |
| --------- | ------------- | ----------------------- |
| `id`      | string (UUID) | Property ID             |
| `owner`   | string        | Owner's Stellar address |

**Success Response (200):**

```json
{
  "success": true,
  "shares": {
    "propertyId": "550e8400-e29b-41d4-a716-446655440000",
    "owner": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "shareCount": 50,
    "shareValue": "250000.00"
  }
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/properties/550e8400-e29b-41d4-a716-446655440000/shares/GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE
```

---

## Lending Endpoints

### 1. List Lending Pools

Retrieve available lending pools with optional filters.

**Endpoint:** `GET /lending/pools`

**Authentication:** None (public)

**Query Parameters:**

| Parameter  | Type    | Description                    |
| ---------- | ------- | ------------------------------ |
| `limit`    | number  | Results per page (default: 10) |
| `offset`   | number  | Pagination offset (default: 0) |
| `asset`    | string  | Filter by asset symbol         |
| `isActive` | boolean | Filter by active status        |

**Success Response (200):**

```json
{
  "success": true,
  "pools": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "USDC Lending Pool",
      "asset": "USDC",
      "assetAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
      "totalDeposits": "1000000.00",
      "totalBorrows": "600000.00",
      "utilizationRate": "0.60",
      "currentAPY": "0.08",
      "borrowAPY": "0.12",
      "collateralFactor": "0.80",
      "liquidationThreshold": "0.85",
      "liquidationPenalty": "0.05",
      "isActive": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

**cURL Example:**

```bash
curl "https://api.akkuea.com/lending/pools?asset=USDC&isActive=true"
```

### 2. Get Single Pool

Retrieve details of a specific lending pool.

**Endpoint:** `GET /lending/pools/:id`

**Authentication:** None (public)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Pool ID     |

**Success Response (200):**

```json
{
  "success": true,
  "pool": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "USDC Lending Pool",
    "asset": "USDC",
    "totalDeposits": "1000000.00",
    "totalBorrows": "600000.00",
    "utilizationRate": "0.60",
    "currentAPY": "0.08",
    "borrowAPY": "0.12",
    "collateralFactor": "0.80",
    "isActive": true
  }
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/lending/pools/770e8400-e29b-41d4-a716-446655440002
```

### 3. Deposit into Pool

Deposit funds into a lending pool to earn interest.

**Endpoint:** `POST /lending/pools/:id/deposit`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Pool ID     |

**Request Body:**

```json
{
  "amount": "10000.50"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "deposit": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "poolId": "770e8400-e29b-41d4-a716-446655440002",
    "depositor": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "amount": "10000.50",
    "depositTokens": "10050.25",
    "interestEarned": "0.00",
    "status": "confirmed",
    "createdAt": "2026-06-29T10:40:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/lending/pools/770e8400-e29b-41d4-a716-446655440002/deposit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "10000.50"
  }'
```

### 4. Withdraw from Pool

Withdraw deposited funds from a lending pool.

**Endpoint:** `POST /lending/pools/:id/withdraw`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Pool ID     |

**Request Body:**

```json
{
  "amount": "5000.00"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "withdrawal": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "poolId": "770e8400-e29b-41d4-a716-446655440002",
    "withdrawer": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "amount": "5000.00",
    "interestEarned": "12.50",
    "status": "confirmed",
    "completedAt": "2026-06-29T10:45:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/lending/pools/770e8400-e29b-41d4-a716-446655440002/withdraw \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5000.00"
  }'
```

### 5. Borrow from Pool

Borrow funds against collateral.

**Endpoint:** `POST /lending/pools/:id/borrow`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Pool ID     |

**Request Body:**

```json
{
  "borrowAmount": "50000.00",
  "collateralAmount": "75000.00",
  "collateralAsset": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "loan": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "poolId": "770e8400-e29b-41d4-a716-446655440002",
    "borrower": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "borrowAmount": "50000.00",
    "collateralAmount": "75000.00",
    "collateralRatio": "1.5",
    "currentInterest": "0.00",
    "status": "active",
    "createdAt": "2026-06-29T10:50:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/lending/pools/770e8400-e29b-41d4-a716-446655440002/borrow \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "borrowAmount": "50000.00",
    "collateralAmount": "75000.00",
    "collateralAsset": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
  }'
```

### 6. Repay Loan

Repay borrowed funds.

**Endpoint:** `POST /lending/pools/:id/repay`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | Pool ID     |

**Request Body:**

```json
{
  "amount": "50000.00"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "repayment": {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "loanId": "aa0e8400-e29b-41d4-a716-446655440005",
    "amount": "50000.00",
    "interestPaid": "125.00",
    "principalPaid": "49875.00",
    "remainingBalance": "0.00",
    "loanStatus": "repaid",
    "completedAt": "2026-06-29T10:55:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/lending/pools/770e8400-e29b-41d4-a716-446655440002/repay \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "50000.00"
  }'
```

---

## KYC Endpoints

### 1. Get KYC Status

Retrieve the KYC verification status for a user.

**Endpoint:** `GET /kyc/status/:userId`

**Authentication:** Required (Bearer token, must be own user)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `userId`  | string (UUID) | User ID     |

**Success Response (200):**

```json
{
  "success": true,
  "kyc": {
    "userId": "cc0e8400-e29b-41d4-a716-446655440007",
    "status": "pending",
    "submittedAt": "2026-06-28T15:00:00.000Z",
    "verifiedAt": null,
    "tier": "basic",
    "documents": [
      {
        "id": "dd0e8400-e29b-41d4-a716-446655440008",
        "type": "passport",
        "status": "verified",
        "uploadedAt": "2026-06-28T14:30:00.000Z",
        "verifiedAt": "2026-06-29T09:00:00.000Z"
      }
    ]
  }
}
```

**Error Response (403):**

```json
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Access denied",
  "statusCode": 403,
  "timestamp": "2026-06-29T11:00:00.000Z"
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/kyc/status/cc0e8400-e29b-41d4-a716-446655440007 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Upload KYC Document

Upload a document for KYC verification.

**Endpoint:** `POST /kyc/upload`

**Authentication:** Required (Bearer token)

**Request Headers:**

```
Content-Type: multipart/form-data
Authorization: Bearer YOUR_JWT_TOKEN
```

**Form Parameters:**

| Parameter      | Type          | Description                                                                                                  |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| `userId`       | string (UUID) | User ID                                                                                                      |
| `documentType` | string        | Type: passport, id_card, proof_of_address, national_id, drivers_license, bank_statement, tax_document, other |
| `file`         | file          | Document file (PDF, JPG, PNG)                                                                                |

**Success Response (200):**

```json
{
  "documentId": "ee0e8400-e29b-41d4-a716-446655440009",
  "submissionId": "ff0e8400-e29b-41d4-a716-446655440010"
}
```

**Error Response (400):**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "documentType must be one of: passport, id_card, proof_of_address, other, national_id, drivers_license, bank_statement, tax_document",
  "statusCode": 400,
  "timestamp": "2026-06-29T11:05:00.000Z"
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/kyc/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "userId=cc0e8400-e29b-41d4-a716-446655440007" \
  -F "documentType=passport" \
  -F "file=@/path/to/passport.pdf"
```

### 3. Get KYC Documents

Retrieve all uploaded KYC documents for a user.

**Endpoint:** `GET /kyc/documents/:userId`

**Authentication:** Required (Bearer token, must be own user)

**URL Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `userId`  | string (UUID) | User ID     |

**Success Response (200):**

```json
{
  "success": true,
  "documents": [
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440008",
      "type": "passport",
      "status": "verified",
      "fileName": "passport.pdf",
      "fileSize": 2048000,
      "uploadedAt": "2026-06-28T14:30:00.000Z",
      "verifiedAt": "2026-06-29T09:00:00.000Z",
      "verificationNotes": "Document verified successfully"
    },
    {
      "id": "ee0e8400-e29b-41d4-a716-446655440009",
      "type": "proof_of_address",
      "status": "pending_review",
      "fileName": "address_proof.pdf",
      "fileSize": 1024000,
      "uploadedAt": "2026-06-29T11:00:00.000Z",
      "verifiedAt": null
    }
  ]
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/kyc/documents/cc0e8400-e29b-41d4-a716-446655440007 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Download Document

Retrieve an uploaded KYC document file.

**Endpoint:** `GET /kyc/file/:documentId`

**Authentication:** None (public, document is served inline)

**URL Parameters:**

| Parameter    | Type          | Description |
| ------------ | ------------- | ----------- |
| `documentId` | string (UUID) | Document ID |

**Success Response (200):**

```
Content-Type: application/pdf
Content-Disposition: inline; filename="passport.pdf"

[Binary file content]
```

**cURL Example:**

```bash
curl https://api.akkuea.com/kyc/file/dd0e8400-e29b-41d4-a716-446655440008 \
  -o downloaded_passport.pdf
```

---

## Notifications Endpoints

### 1. Get User Notifications

Retrieve paginated list of user notifications.

**Endpoint:** `GET /notifications`

**Authentication:** Required (Bearer token)

**Query Parameters:**

| Parameter | Type   | Description                    |
| --------- | ------ | ------------------------------ |
| `limit`   | number | Results per page (default: 20) |
| `offset`  | number | Pagination offset (default: 0) |

**Success Response (200):**

```json
{
  "success": true,
  "notifications": [
    {
      "id": "gg0e8400-e29b-41d4-a716-446655440011",
      "userId": "cc0e8400-e29b-41d4-a716-446655440007",
      "type": "share_purchase",
      "title": "Property Share Purchased",
      "message": "Your purchase of 50 shares has been confirmed",
      "read": false,
      "data": {
        "propertyId": "550e8400-e29b-41d4-a716-446655440000",
        "shares": 50
      },
      "createdAt": "2026-06-29T11:15:00.000Z",
      "readAt": null
    },
    {
      "id": "hh0e8400-e29b-41d4-a716-446655440012",
      "userId": "cc0e8400-e29b-41d4-a716-446655440007",
      "type": "deposit_interest",
      "title": "Interest Earned",
      "message": "You earned 12.50 USDC in interest",
      "read": true,
      "data": {
        "poolId": "770e8400-e29b-41d4-a716-446655440002",
        "amount": "12.50"
      },
      "createdAt": "2026-06-29T10:00:00.000Z",
      "readAt": "2026-06-29T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

**cURL Example:**

```bash
curl "https://api.akkuea.com/notifications?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Get Unread Count

Get the count of unread notifications.

**Endpoint:** `GET /notifications/unread-count`

**Authentication:** Required (Bearer token)

**Success Response (200):**

```json
{
  "success": true,
  "unreadCount": 5
}
```

**cURL Example:**

```bash
curl https://api.akkuea.com/notifications/unread-count \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Mark Notification as Read

Mark a single notification as read.

**Endpoint:** `PATCH /notifications/:id/read`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type          | Description     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | Notification ID |

**Success Response (200):**

```json
{
  "success": true,
  "notification": {
    "id": "gg0e8400-e29b-41d4-a716-446655440011",
    "read": true,
    "readAt": "2026-06-29T11:20:00.000Z"
  }
}
```

**cURL Example:**

```bash
curl -X PATCH https://api.akkuea.com/notifications/gg0e8400-e29b-41d4-a716-446655440011/read \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Mark Multiple Notifications as Read

Mark multiple notifications as read in a single request.

**Endpoint:** `POST /notifications/read-multiple`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "notificationIds": [
    "gg0e8400-e29b-41d4-a716-446655440011",
    "hh0e8400-e29b-41d4-a716-446655440012",
    "ii0e8400-e29b-41d4-a716-446655440013"
  ]
}
```

**Success Response (200):**

```json
{
  "success": true,
  "updatedCount": 3
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/notifications/read-multiple \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notificationIds": [
      "gg0e8400-e29b-41d4-a716-446655440011",
      "hh0e8400-e29b-41d4-a716-446655440012"
    ]
  }'
```

### 5. Mark All Notifications as Read

Mark all user notifications as read.

**Endpoint:** `POST /notifications/read-all`

**Authentication:** Required (Bearer token)

**Success Response (200):**

```json
{
  "success": true,
  "updatedCount": 42
}
```

**cURL Example:**

```bash
curl -X POST https://api.akkuea.com/notifications/read-all \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Response Examples

### Success Response Format

All successful responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Endpoint-specific data
  }
}
```

### Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2026-06-29T11:30:00.000Z"
}
```

### HTTP Status Codes

| Code | Meaning               | Example                                                      |
| ---- | --------------------- | ------------------------------------------------------------ |
| 200  | OK                    | Successful GET, PATCH, or POST/PUT with successful operation |
| 201  | Created               | Resource created successfully                                |
| 400  | Bad Request           | Invalid parameters, missing required fields                  |
| 401  | Unauthorized          | Missing, invalid, or expired JWT token                       |
| 403  | Forbidden             | User lacks required permissions                              |
| 404  | Not Found             | Resource doesn't exist                                       |
| 429  | Too Many Requests     | Rate limit exceeded                                          |
| 500  | Internal Server Error | Server-side error                                            |

### Common Validation Errors

**Invalid UUID Format:**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "Invalid property ID format",
  "statusCode": 400,
  "timestamp": "2026-06-29T11:35:00.000Z"
}
```

**Invalid Stellar Address:**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "Invalid Stellar address format",
  "statusCode": 400,
  "timestamp": "2026-06-29T11:40:00.000Z"
}
```

**Insufficient Funds:**

```json
{
  "success": false,
  "error": "BAD_REQUEST",
  "message": "Insufficient balance for this transaction",
  "statusCode": 400,
  "timestamp": "2026-06-29T11:45:00.000Z"
}
```

### Example: Complete Auth Flow

**Step 1: Get Challenge**

```bash
curl -X POST https://api.akkuea.com/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
  }'
```

Response:

```json
{
  "success": true,
  "challenge": "Login to Akkuea: unique-nonce-12345",
  "expiresAt": "2026-06-29T11:45:00.000Z"
}
```

**Step 2: Sign Challenge** (done in wallet)

**Step 3: Verify Session**

```bash
curl -X POST https://api.akkuea.com/auth/session \
  -H "Content-Type: application/json" \
  -d '{
    "stellarAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE",
    "signature": "signed-message-from-wallet"
  }'
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJHQlJQWUhJTDJDSTR4S0JPVUZNSFg3UkhWTlVKWENKUEtWM0RLWlJHWUdENVlQRlBCWDdCTkxFIiwiaWF0IjoxNjg4MDAwMDAwfQ.abcd1234efgh5678",
  "expiresIn": 86400,
  "userAddress": "GBRPYHIL2CI4XKBOUFMHX7RHVNUJXCJPKV3DKZRGYGD5YPFPBX7BNLE"
}
```

**Step 4: Use Token in Requests**

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  https://api.akkuea.com/properties
```

---

## Admin Endpoints

### 1. Get Audit Logs

Retrieve paginated audit logs for admin operations.

**Endpoint:** `GET /api/v1/admin/audit-log`

**Authentication:** Required (Admin Operator Wallet)

**Headers:**

- `x-operator-wallet`: Admin operator wallet address (string)

**Query Parameters:**

| Parameter    | Type   | Description                                 |
| ------------ | ------ | ------------------------------------------- |
| `page`       | number | Page number (default: 1)                    |
| `limit`      | number | Results per page (default: 20)              |
| `actor`      | string | Filter by actor's wallet address            |
| `actionType` | string | Filter by action type (e.g., LOGIN, UPDATE) |
| `startDate`  | string | Filter by start date (YYYY-MM-DD)           |
| `endDate`    | string | Filter by end date (YYYY-MM-DD)             |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "actor": "0xABCDEF",
      "actionType": "LOGIN",
      "timestamp": "2023-10-10T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1688000060
```

### Rate Limit Endpoints

- **Public endpoints** (GET requests): 1000 requests/hour
- **Authenticated endpoints** (POST, PUT, PATCH, DELETE): 500 requests/hour per user

### Rate Limit Response

When rate limited, you'll receive:

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry after 60 seconds",
  "statusCode": 429,
  "timestamp": "2026-06-29T12:00:00.000Z",
  "retryAfter": 60
}
```

---

## Versioning

The API uses version numbers in the base URL path format:

```
https://api.akkuea.com/v1/properties  (Versioned)
https://api.akkuea.com/properties     (Current - defaults to v1)
```

### Current Version

- **Version:** 1.0.0
- **Release Date:** 2026-06-01
- **Status:** Stable

### Version Support

- **v1.x**: Full support
- **v0.x**: Deprecated (sunset 2026-12-31)

### Checking API Version

Check available version information via the health endpoint:

```bash
curl https://api.akkuea.com/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2026-06-29T12:05:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": {
      "healthy": true,
      "latency": 12
    }
  }
}
```

---

## Quick Start Guide

### For Frontend Developers

1. **Setup Authentication**
   - Integrate Stellar wallet signing
   - Call `/auth/challenge` → get nonce → sign in wallet → call `/auth/session`
   - Store JWT token securely

2. **Load Properties**
   - `GET /properties` for listing
   - `GET /properties/:id` for details
   - Use auth token for buying shares

3. **Handle Errors**
   - Check `error` field for error code
   - Use `message` for user-facing text
   - Check `statusCode` for HTTP status

### For API Integrators

1. **Authentication Setup**
   - Implement Stellar challenge-response flow
   - Store JWT tokens with expiration
   - Refresh tokens before expiry

2. **Error Handling**
   - Implement retry logic for 5xx errors
   - Respect rate limits (check headers)
   - Parse error responses for codes

3. **Production Considerations**
   - Use HTTPS only
   - Validate all inputs client-side
   - Implement request signing if needed
   - Monitor rate limits and adjust

### Testing Endpoints

**Health Check:**

```bash
curl https://api.akkuea.com/health
```

**List Properties (No Auth):**

```bash
curl https://api.akkuea.com/properties?limit=5
```

**Create Property (Requires Auth):**

```bash
curl -X POST https://api.akkuea.com/properties \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Support & Resources

- **Documentation:** https://docs.akkuea.com
- **Swagger UI:** https://api.akkuea.com/swagger
- **GitHub Issues:** https://github.com/1sraeliteX/akkuea/issues
- **Community:** https://discord.gg/akkuea

---

## Changelog

### Version 1.0.0 (2026-06-01)

**Features:**

- Authentication via Stellar wallet
- Property tokenization and share trading
- Lending pool management
- KYC document upload
- Real-time notifications
- Rate limiting per user

**Fixes:**

- Improved error messages
- Better validation
- Optimized database queries
