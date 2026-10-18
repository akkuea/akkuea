import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Lightweight descriptor for a single field in a Zod object schema. */
export interface FieldDefinition {
  /** Human-readable type label (e.g. "string", "number", "ZodObject"). */
  type: string;
  /** Whether the field is required (not optional / nullable / defaulted). */
  required: boolean;
  /** Description from .describe() if present. */
  description?: string;
  /** For object fields, the nested field map. */
  fields?: Record<string, FieldDefinition>;
  /** For array fields, the element definition. */
  element?: FieldDefinition;
  /** For union fields, the member definitions. */
  options?: FieldDefinition[];
}

/**
 * A named snapshot of a ZodObject schema used for version-comparison.
 */
export interface SchemaSnapshot {
  /** Unique name for the schema (e.g. "PropertyInfo", "Transaction"). */
  name: string;
  /** Map of top-level field definitions. */
  fields: Record<string, FieldDefinition>;
  /** ISO timestamp of when the snapshot was taken. */
  capturedAt: string;
}

/**
 * Result of comparing two schema snapshots.
 */
export interface SchemaDiff {
  /** Fields added in the current version. */
  added: string[];
  /** Fields removed from the current version. */
  removed: string[];
  /** Fields whose definition changed (type, required flag, nested fields). */
  changed: {
    field: string;
    details: string[];
  }[];
}

// ---------------------------------------------------------------------------
// Zod unwrapping helpers
// ---------------------------------------------------------------------------

/**
 * v4 `_def` as a loose record. The literal `type` discriminator is the only
 * field we rely on across every wrapper; the rest are read per-case and cast.
 */
type LooseDef = { type?: string; [key: string]: unknown };

function rawDef(schema: z.ZodType): LooseDef {
  return schema._def as unknown as LooseDef;
}

/**
 * Type label for a schema, matching the class names v3 exposed
 * ("ZodString", "ZodObject", …) so snapshots stay comparable across the
 * migration. v4 stores the same information as `_def.type` ("string", …).
 */
function typeLabel(schema: z.ZodType): string {
  const type = rawDef(schema).type;
  if (typeof type !== "string" || type.length === 0) return "ZodUnknown";
  return `Zod${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/**
 * Strip away Zod wrapper types (Optional, Nullable, Default, Readonly, Pipe,
 * Lazy) to reach the *inner* schema that carries the structural information.
 *
 * zod v4 removed the class hierarchy the v3 version of this helper switched on
 * (`ZodEffects`, `ZodPipeline`, `ZodBranded` no longer exist), and `_def` is now
 * a discriminated record keyed by a literal `type` string. Dispatching on that
 * string keeps the helper working across wrappers without depending on classes
 * that may be renamed again.
 *
 * IMPORTANT: `current` is always initialised from a concrete schema argument,
 * and the loop body only assigns from known `_def` properties. Every branch
 * either reassigns or returns, so `current` is never `undefined` on return.
 */
export function unwrapZodSchema(schema: z.ZodType): z.ZodType {
  let current: z.ZodType = schema;

  // Bounded walk: a malformed lazy chain must not hang the process.
  for (let guard = 0; guard < 100; guard += 1) {
    const def = rawDef(current);
    switch (def.type) {
      // ---- Wrappers that carry .innerType ----
      case "optional":
      case "nullable":
      case "default":
      case "readonly":
        current = def.innerType as z.ZodType;
        break;

      // ---- Pipe: prefer the *output* side, which holds the validated shape ----
      case "pipe": {
        const out = def.out as z.ZodType;
        // `z.string().transform(…)` produces ZodPipe<string, ZodTransform>;
        // the transform carries no structure, so fall back to the input schema.
        current =
          rawDef(out).type === "transform" ? (def.in as z.ZodType) : out;
        break;
      }

      // ---- Lazy: resolve once ----
      case "lazy": {
        const resolved = (def.getter as () => z.ZodType)();
        // Guard against a getter that returns its own wrapper.
        if (resolved === current) return current;
        current = resolved;
        break;
      }

      // ---- Base case – nothing left to unwrap ----
      default:
        return current;
    }
  }

  return current;
}

// ---------------------------------------------------------------------------
// Field-definition extraction
// ---------------------------------------------------------------------------

/**
 * Walk a (possibly wrapped) Zod schema and produce a {@link FieldDefinition}.
 */
export function extractFieldDefinition(schema: z.ZodType): FieldDefinition {
  const inner = unwrapZodSchema(schema);
  const required =
    !(schema instanceof z.ZodOptional) &&
    !(schema instanceof z.ZodNullable) &&
    !(schema instanceof z.ZodDefault);

  const base: FieldDefinition = {
    type: typeLabel(inner),
    required,
    description:
      "description" in inner
        ? (inner.description as string | undefined)
        : undefined,
  };
  const def = rawDef(inner);

  // ---- Object ----
  if (inner instanceof z.ZodObject) {
    // v4 exposes `_def.shape` as a plain record; v3 had it as a method.
    const shape = (def.shape ?? {}) as Record<string, z.ZodType>;
    const fields: Record<string, FieldDefinition> = {};
    for (const key of Object.keys(shape)) {
      const fieldSchema: z.ZodType | undefined = shape[key];
      if (fieldSchema) {
        fields[key] = extractFieldDefinition(fieldSchema);
      }
    }
    base.fields = fields;
  }

  // ---- Array ----
  if (inner instanceof z.ZodArray) {
    // v3 stored the element under `_def.type`; v4 renamed it to `_def.element`.
    const elementSchema = def.element as z.ZodType | undefined;
    if (elementSchema) base.element = extractFieldDefinition(elementSchema);
  }

  // ---- Union / DiscriminatedUnion ----
  if (inner instanceof z.ZodUnion || inner instanceof z.ZodDiscriminatedUnion) {
    const options: FieldDefinition[] = [];
    const opts = (def.options ?? []) as readonly z.ZodType[];
    for (const opt of opts) {
      options.push(extractFieldDefinition(opt));
    }
    base.options = options;
  }

  return base;
}

/**
 * Extract a {@link SchemaSnapshot} from a named ZodObject schema.
 */
export function captureSchemaSnapshot(
  name: string,
  schema: z.ZodObject<z.ZodRawShape>,
): SchemaSnapshot {
  const shape = (rawDef(schema).shape ?? {}) as Record<string, z.ZodType>;
  const fields: Record<string, FieldDefinition> = {};

  for (const key of Object.keys(shape)) {
    // With noUncheckedIndexedAccess, bracket access on Record<K,V> returns
    // V | undefined – guard that explicitly.
    const fieldSchema: z.ZodType | undefined = shape[key];
    if (fieldSchema) {
      fields[key] = extractFieldDefinition(fieldSchema);
    }
  }

  return {
    name,
    fields,
    capturedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Recursively compare two {@link FieldDefinition} objects and return a list
 * of human-readable change descriptions (empty = no difference).
 */
export function compareFieldDefinition(
  current: FieldDefinition,
  snapshot: FieldDefinition,
  path: string = "",
): string[] {
  const diffs: string[] = [];
  const prefix = path || "(root)";

  // --- type ---
  if (current.type !== snapshot.type) {
    diffs.push(
      `${prefix}: type changed from "${snapshot.type}" to "${current.type}"`,
    );
  }

  // --- required flag ---
  if (current.required !== snapshot.required) {
    diffs.push(
      `${prefix}: required changed from ${String(snapshot.required)} to ${String(current.required)}`,
    );
  }

  // --- nested fields ---
  const currentFields: Record<string, FieldDefinition> = current.fields ?? {};
  const snapshotFields: Record<string, FieldDefinition> = snapshot.fields ?? {};

  const allKeys = new Set([
    ...Object.keys(currentFields),
    ...Object.keys(snapshotFields),
  ]);

  for (const key of allKeys) {
    const nestedPath = path ? `${path}.${key}` : key;
    const currentField: FieldDefinition | undefined = currentFields[key];
    const snapshotField: FieldDefinition | undefined = snapshotFields[key];

    // Both `currentField` and `snapshotField` may be undefined because
    // `noUncheckedIndexedAccess` forces Record<K,V> lookups to return V|undefined.
    // We explicitly guard before recursing.
    if (!currentField && snapshotField) {
      diffs.push(`${nestedPath}: removed`);
    } else if (currentField && !snapshotField) {
      diffs.push(`${nestedPath}: added`);
    } else if (currentField && snapshotField) {
      diffs.push(
        ...compareFieldDefinition(currentField, snapshotField, nestedPath),
      );
    }
  }

  // --- array element ---
  if (current.element && snapshot.element) {
    diffs.push(
      ...compareFieldDefinition(
        current.element,
        snapshot.element,
        `${prefix}[element]`,
      ),
    );
  } else if (current.element && !snapshot.element) {
    diffs.push(`${prefix}: array element definition added`);
  } else if (!current.element && snapshot.element) {
    diffs.push(`${prefix}: array element definition removed`);
  }

  // --- union options ---
  const currentOpts = current.options ?? [];
  const snapshotOpts = snapshot.options ?? [];
  if (currentOpts.length !== snapshotOpts.length) {
    diffs.push(
      `${prefix}: union members count changed from ${snapshotOpts.length} to ${currentOpts.length}`,
    );
  } else {
    for (let i = 0; i < currentOpts.length; i++) {
      const c = currentOpts[i];
      const s = snapshotOpts[i];
      // `noUncheckedIndexedAccess` means c/s could be undefined for
      // out-of-bounds indices on readonly tuples. Guard before recursing.
      if (c && s) {
        diffs.push(...compareFieldDefinition(c, s, `${prefix}[union@${i}]`));
      }
    }
  }

  return diffs;
}

/**
 * Compare two {@link SchemaSnapshot} objects and produce a structured diff.
 */
export function diffSchemaSnapshots(
  current: SchemaSnapshot,
  snapshot: SchemaSnapshot,
): SchemaDiff {
  const currentKeys = Object.keys(current.fields);
  const snapshotKeys = Object.keys(snapshot.fields);

  const added = currentKeys.filter((k) => !snapshotKeys.includes(k));
  const removed = snapshotKeys.filter((k) => !currentKeys.includes(k));

  const changed: SchemaDiff["changed"] = [];

  for (const key of currentKeys) {
    if (removed.includes(key)) continue;
    const currDef: FieldDefinition | undefined = current.fields[key];
    const snapDef: FieldDefinition | undefined = snapshot.fields[key];

    // Guard against noUncheckedIndexedAccess – the key exists in both maps
    // but TypeScript doesn't know that at the type level.
    if (!currDef || !snapDef) continue;

    const details = compareFieldDefinition(currDef, snapDef, key);
    if (details.length > 0) {
      changed.push({ field: key, details });
    }
  }

  return { added, removed, changed };
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Capture the current shape of a schema and compare it against a previously
 * stored baseline snapshot.  Returns `valid: true` when the current schema
 * exactly matches the baseline, and `valid: false` together with a structured
 * diff otherwise.
 *
 * Use this in CI or a pre-commit hook to prevent accidental breaking schema
 * changes from landing unnoticed.
 */
export function validateSchemaSnapshot(
  name: string,
  schema: z.ZodObject<z.ZodRawShape>,
  baseline: SchemaSnapshot,
): { valid: boolean; diff: SchemaDiff } {
  const current = captureSchemaSnapshot(name, schema);
  const diff = diffSchemaSnapshots(current, baseline);

  // Adding a new *optional* field is not a breaking change - only
  // required-field additions, removals, and type/required changes count.
  // We still return the full diff for diagnostics, but only use
  // breaking additions in the validity decision.
  const breakingAdds = diff.added.filter(
    (key) => current.fields[key]?.required === true,
  );

  return {
    valid:
      breakingAdds.length === 0 &&
      diff.removed.length === 0 &&
      diff.changed.length === 0,
    diff,
  };
}
