import { describe, it, expect } from "bun:test";
import {
  captureSchemaSnapshot,
  diffSchemaSnapshots,
  validateSchemaSnapshot,
  unwrapZodSchema,
  extractFieldDefinition,
  compareFieldDefinition,
  type SchemaSnapshot,
  type FieldDefinition,
  type SchemaDiff,
} from "../../src/utils/schema-versioning";
import { propertyInfoSchema, lendingPoolSchema } from "../../src/schemas";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Baseline snapshots – committed alongside the code so CI can detect
// accidental breaking schema changes.
// ---------------------------------------------------------------------------
import baselineSnapshots from "../snapshots/schema-v1.json";

const propertyInfoBaseline = (
  baselineSnapshots as Record<string, SchemaSnapshot>
).propertyInfo as SchemaSnapshot;
const lendingPoolBaseline = (
  baselineSnapshots as Record<string, SchemaSnapshot>
).lendingPool as SchemaSnapshot;

// ---------------------------------------------------------------------------
// Unit tests for the individual utility functions
// ---------------------------------------------------------------------------

describe("unwrapZodSchema", () => {
  it("returns the same schema when there is no wrapper", () => {
    const schema = z.string();
    const result = unwrapZodSchema(schema);
    expect(result).toBe(schema);
  });

  it("unwraps ZodOptional to the inner type", () => {
    const schema = z.string().optional();
    const inner = unwrapZodSchema(schema);
    expect(inner instanceof z.ZodString).toBe(true);
    expect(inner instanceof z.ZodOptional).toBe(false);
  });

  it("unwraps ZodNullable to the inner type", () => {
    const schema = z.string().nullable();
    const inner = unwrapZodSchema(schema);
    expect(inner instanceof z.ZodString).toBe(true);
  });

  it("unwraps ZodDefault to the inner type", () => {
    const schema = z.string().default("hello");
    const inner = unwrapZodSchema(schema);
    expect(inner instanceof z.ZodString).toBe(true);
  });

  it("unwraps ZodEffects to the inner type", () => {
    const schema = z.string().refine(() => true);
    const inner = unwrapZodSchema(schema);
    expect(inner instanceof z.ZodString).toBe(true);
  });

  it("unwraps nested wrappers", () => {
    const schema = z
      .string()
      .refine(() => true)
      .optional()
      .nullable();
    const inner = unwrapZodSchema(schema);
    expect(inner instanceof z.ZodString).toBe(true);
  });
});

describe("extractFieldDefinition", () => {
  it("extracts type and required flag for a simple string", () => {
    const def = extractFieldDefinition(z.string());
    expect(def.type).toBe("ZodString");
    expect(def.required).toBe(true);
  });

  it("marks optional fields as not required", () => {
    const def = extractFieldDefinition(z.string().optional());
    expect(def.type).toBe("ZodString");
    expect(def.required).toBe(false);
  });

  it("marks nullable fields as not required", () => {
    const def = extractFieldDefinition(z.string().nullable());
    expect(def.type).toBe("ZodString");
    expect(def.required).toBe(false);
  });

  it("marks defaulted fields as not required", () => {
    const def = extractFieldDefinition(z.string().default("x"));
    expect(def.type).toBe("ZodString");
    expect(def.required).toBe(false);
  });

  it("extracts nested object fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const def = extractFieldDefinition(schema);
    expect(def.type).toBe("ZodObject");
    expect(def.fields).toBeDefined();
    expect(def.fields!.name?.type).toBe("ZodString");
    expect(def.fields!.name?.required).toBe(true);
    expect(def.fields!.age?.type).toBe("ZodNumber");
    expect(def.fields!.age?.required).toBe(false);
  });

  it("extracts array element definitions", () => {
    const schema = z.array(z.string());
    const def = extractFieldDefinition(schema);
    expect(def.type).toBe("ZodArray");
    expect(def.element).toBeDefined();
    expect(def.element!.type).toBe("ZodString");
  });

  it("extracts enum types", () => {
    const schema = z.enum(["a", "b", "c"]);
    const def = extractFieldDefinition(schema);
    expect(def.type).toBe("ZodEnum");
    expect(def.required).toBe(true);
  });

  it("includes descriptions when provided", () => {
    const schema = z.string().describe("A helpful description");
    const def = extractFieldDefinition(schema);
    expect(def.description).toBe("A helpful description");
  });
});

describe("compareFieldDefinition", () => {
  it("returns no diffs for identical definitions", () => {
    const a: FieldDefinition = { type: "ZodString", required: true };
    const b: FieldDefinition = { type: "ZodString", required: true };
    expect(compareFieldDefinition(a, b)).toEqual([]);
  });

  it("detects type changes", () => {
    const current: FieldDefinition = { type: "ZodNumber", required: true };
    const snapshot: FieldDefinition = { type: "ZodString", required: true };
    const diffs = compareFieldDefinition(current, snapshot);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0]).toContain("type changed");
  });

  it("detects required flag changes", () => {
    const current: FieldDefinition = { type: "ZodString", required: true };
    const snapshot: FieldDefinition = { type: "ZodString", required: false };
    const diffs = compareFieldDefinition(current, snapshot);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs[0]).toContain("required changed");
  });

  it("detects added nested fields", () => {
    const current: FieldDefinition = {
      type: "ZodObject",
      required: true,
      fields: {
        x: { type: "ZodString", required: true },
        y: { type: "ZodString", required: true },
      },
    };
    const snapshot: FieldDefinition = {
      type: "ZodObject",
      required: true,
      fields: {
        x: { type: "ZodString", required: true },
      },
    };
    const diffs = compareFieldDefinition(current, snapshot);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.some((d) => d.includes("y") && d.includes("added"))).toBe(
      true,
    );
  });

  it("detects removed nested fields", () => {
    const current: FieldDefinition = {
      type: "ZodObject",
      required: true,
      fields: { x: { type: "ZodString", required: true } },
    };
    const snapshot: FieldDefinition = {
      type: "ZodObject",
      required: true,
      fields: {
        x: { type: "ZodString", required: true },
        y: { type: "ZodString", required: true },
      },
    };
    const diffs = compareFieldDefinition(current, snapshot);
    expect(diffs.length).toBeGreaterThan(0);
    expect(diffs.some((d) => d.includes("y") && d.includes("removed"))).toBe(
      true,
    );
  });
});

describe("diffSchemaSnapshots", () => {
  it("returns an empty diff when snapshots are identical", () => {
    const snap: SchemaSnapshot = {
      name: "Test",
      fields: { a: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const diff = diffSchemaSnapshots(snap, { ...snap });
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it("detects added fields", () => {
    const current: SchemaSnapshot = {
      name: "Test",
      fields: {
        a: { type: "ZodString", required: true },
        b: { type: "ZodNumber", required: true },
      },
      capturedAt: new Date().toISOString(),
    };
    const snapshot: SchemaSnapshot = {
      name: "Test",
      fields: { a: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const diff = diffSchemaSnapshots(current, snapshot);
    expect(diff.added).toEqual(["b"]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it("detects removed fields", () => {
    const current: SchemaSnapshot = {
      name: "Test",
      fields: { a: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const snapshot: SchemaSnapshot = {
      name: "Test",
      fields: {
        a: { type: "ZodString", required: true },
        b: { type: "ZodNumber", required: true },
      },
      capturedAt: new Date().toISOString(),
    };
    const diff = diffSchemaSnapshots(current, snapshot);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual(["b"]);
    expect(diff.changed).toEqual([]);
  });

  it("detects changed fields", () => {
    const current: SchemaSnapshot = {
      name: "Test",
      fields: { a: { type: "ZodNumber", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const snapshot: SchemaSnapshot = {
      name: "Test",
      fields: { a: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const diff = diffSchemaSnapshots(current, snapshot);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed.length).toBe(1);
    expect(diff.changed[0]!.field).toBe("a");
  });
});

describe("captureSchemaSnapshot", () => {
  it("captures a snapshot with the correct name", () => {
    const schema = z.object({ id: z.string() });
    const snap = captureSchemaSnapshot("MySchema", schema);
    expect(snap.name).toBe("MySchema");
    expect(snap.capturedAt).toBeDefined();
    expect(snap.fields.id).toBeDefined();
  });

  it("captures all top-level fields", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const snap = captureSchemaSnapshot("Test", schema);
    expect(Object.keys(snap.fields)).toContain("name");
    expect(Object.keys(snap.fields)).toContain("age");
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria – validate real project schemas against the committed
// baseline snapshot.  These tests MUST pass in CI; failure means a breaking
// schema change was introduced without updating the baseline.
// ---------------------------------------------------------------------------

describe("validateSchemaSnapshot", () => {
  it("PropertyInfo matches the versioned baseline snapshot", () => {
    const result = validateSchemaSnapshot(
      "PropertyInfo",
      propertyInfoSchema,
      propertyInfoBaseline,
    );

    if (!result.valid) {
      // Pretty-print the diff so the developer knows exactly what changed.
      console.error(
        "Schema diff for PropertyInfo:\n" +
          JSON.stringify(result.diff, null, 2),
      );
    }

    expect(result.valid).toBe(true);
  });

  it("LendingPool matches the versioned baseline snapshot", () => {
    const result = validateSchemaSnapshot(
      "LendingPool",
      lendingPoolSchema,
      lendingPoolBaseline,
    );

    if (!result.valid) {
      console.error(
        "Schema diff for LendingPool:\n" + JSON.stringify(result.diff, null, 2),
      );
    }

    expect(result.valid).toBe(true);
  });

  it("returns valid when adding a new optional field (non-breaking)", () => {
    const baseline: SchemaSnapshot = {
      name: "Test",
      fields: { x: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    // Schema with an *optional* field added on top of the baseline.
    const schemaWithOptional = z.object({
      x: z.string(),
      y: z.string().optional(),
    });
    const result = validateSchemaSnapshot("Test", schemaWithOptional, baseline);
    expect(result.valid).toBe(true);
  });

  it("returns invalid when adding a new required field (breaking)", () => {
    const baseline: SchemaSnapshot = {
      name: "Test",
      fields: { x: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    // Schema with a *required* field added on top of the baseline.
    const schemaWithRequired = z.object({
      x: z.string(),
      y: z.string(),
    });
    const result = validateSchemaSnapshot("Test", schemaWithRequired, baseline);
    expect(result.valid).toBe(false);
  });

  it("returns invalid when a field type has changed", () => {
    const baseline: SchemaSnapshot = {
      name: "Test",
      fields: { x: { type: "ZodString", required: true } },
      capturedAt: new Date().toISOString(),
    };
    const changedSchema = z.object({ x: z.number() });
    const result = validateSchemaSnapshot("Test", changedSchema, baseline);
    expect(result.valid).toBe(false);
    expect(result.diff.changed.length).toBeGreaterThan(0);
  });
});
