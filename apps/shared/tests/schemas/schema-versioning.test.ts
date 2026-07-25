/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { propertyInfoSchema, lendingPoolSchema } from "../../src/schemas";
import {
  validateSchemaSnapshot,
  extractSchemaShape,
  type SchemaSnapshot,
} from "../../src/utils/schema-versioning";
import schemaV1 from "../snapshots/schema-v1.json";

describe("Schema Versioning Guard", () => {
  it("should pass baseline check for PropertyInfo and LendingPool against v1 snapshot", () => {
    const result = validateSchemaSnapshot(
      {
        PropertyInfo: propertyInfoSchema,
        LendingPool: lendingPoolSchema,
      },
      schemaV1 as SchemaSnapshot
    );

    expect(result.compatible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when an existing required field is modified or removed without a snapshot update", () => {
    // Simulate removing a required field 'description' from PropertyInfo schema
    const modifiedPropertySchema = z.object({
      id: z.string().uuid(),
      name: z.string(),
      // description missing
      propertyType: z.enum([
        "residential",
        "commercial",
        "industrial",
        "land",
        "mixed",
      ]),
    });

    const result = validateSchemaSnapshot(
      {
        PropertyInfo: modifiedPropertySchema,
      },
      schemaV1 as SchemaSnapshot
    );

    expect(result.compatible).toBe(false);
    expect(result.errors.some((err) => err.includes("description"))).toBe(true);
  });

  it("should fail when an existing required field type is changed", () => {
    const modifiedLendingSchema = z.object({
      ...lendingPoolSchema.shape,
      utilizationRate: z.string(), // Changed from number to string
    });

    const result = validateSchemaSnapshot(
      {
        LendingPool: modifiedLendingSchema,
      },
      schemaV1 as SchemaSnapshot
    );

    expect(result.compatible).toBe(false);
    expect(
      result.errors.some(
        (err) => err.includes("utilizationRate") && err.includes("type changed")
      )
    ).toBe(true);
  });

  it("should fail when a new required field is added without a snapshot update", () => {
    const modifiedPropertySchema = propertyInfoSchema.extend({
      newRequiredField: z.string(),
    });

    const result = validateSchemaSnapshot(
      {
        PropertyInfo: modifiedPropertySchema,
      },
      schemaV1 as SchemaSnapshot
    );

    expect(result.compatible).toBe(false);
    expect(
      result.errors.some(
        (err) =>
          err.includes("newRequiredField") && err.includes("added without updating snapshot")
      )
    ).toBe(true);
  });

  it("should NOT break when a new optional field is added (acceptance criterion #2)", () => {
    const modifiedPropertySchema = propertyInfoSchema.extend({
      metadata: z.record(z.string()).optional(),
    });

    const result = validateSchemaSnapshot(
      {
        PropertyInfo: modifiedPropertySchema,
        LendingPool: lendingPoolSchema,
      },
      schemaV1 as SchemaSnapshot
    );

    expect(result.compatible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should pass after updating snapshot for intentional schema changes", () => {
    const updatedPropertySchema = propertyInfoSchema.extend({
      newFeatureFlag: z.boolean(),
    });

    const updatedSnapshot: SchemaSnapshot = {
      version: "1.1.0",
      schemas: {
        PropertyInfo: extractSchemaShape(updatedPropertySchema),
        LendingPool: extractSchemaShape(lendingPoolSchema),
      },
    };

    const result = validateSchemaSnapshot(
      {
        PropertyInfo: updatedPropertySchema,
        LendingPool: lendingPoolSchema,
      },
      updatedSnapshot
    );

    expect(result.compatible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
