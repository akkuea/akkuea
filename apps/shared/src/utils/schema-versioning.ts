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

/** Loose view of a Zod 4 schema definition (`schema.def`). */
interface ZodDefView {
  type: string;
  innerType?: z.ZodType;
  in?: z.ZodType;
  out?: z.ZodType;
  getter?: () => z.ZodType;
  element?: z.ZodType;
  options?: readonly z.ZodType[];
  shape?: Record<string, z.ZodType>;
}

function defOf(schema: z.ZodType): ZodDefView {
  return schema.def as unknown as ZodDefView;
}

/** Legacy-style label for a schema, e.g. "ZodString" or "ZodObject". */
function typeLabel(schema: z.ZodType): string {
  const type = defOf(schema).type;
  return `Zod${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

/**
 * Strip away Zod wrapper types (Optional, Nullable, Default, Readonly, Catch,
 * Pipe, Lazy) to reach the *inner* schema that carries the structural
 * information.
 *
 * Refinements no longer wrap a schema in Zod 4, so there is no separate
 * "effects" layer to unwrap. The loop terminates because every branch either
 * reassigns `current` or breaks.
 */
export function unwrapZodSchema(schema: z.ZodType): z.ZodType {
  let current: z.ZodType = schema;

  while (true) {
    const def = defOf(current);

    if (
      (def.type === "optional" ||
        def.type === "nullable" ||
        def.type === "default" ||
        def.type === "prefault" ||
        def.type === "nonoptional" ||
        def.type === "readonly" ||
        def.type === "catch") &&
      def.innerType
    ) {
      current = def.innerType;
    } else if (def.type === "pipe" && def.in && def.out) {
      // Prefer the *output* side as it represents the validated shape, unless
      // it is a bare transform (what `.transform()` produces).
      current = defOf(def.out).type === "transform" ? def.in : def.out;
    } else if (def.type === "lazy" && def.getter) {
      const resolved = def.getter();
      // Guard against accidental infinite loops.
      if (resolved === current) break;
      current = resolved;
    } else {
      break;
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
  const outerType = defOf(schema).type;
  const required =
    outerType !== "optional" &&
    outerType !== "nullable" &&
    outerType !== "default";

  const base: FieldDefinition = {
    type: typeLabel(inner),
    required,
    description: inner.description,
  };

  const def = defOf(inner);

  // ---- Object ----
  if (def.type === "object" && def.shape) {
    const fields: Record<string, FieldDefinition> = {};
    for (const [key, fieldSchema] of Object.entries(def.shape)) {
      fields[key] = extractFieldDefinition(fieldSchema);
    }
    base.fields = fields;
  }

  // ---- Array ----
  if (def.type === "array" && def.element) {
    base.element = extractFieldDefinition(def.element);
  }

  // ---- Union / DiscriminatedUnion ----
  if (def.type === "union" && def.options) {
    base.options = def.options.map((opt) => extractFieldDefinition(opt));
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
  const fields: Record<string, FieldDefinition> = {};

  for (const [key, fieldSchema] of Object.entries(schema.shape)) {
    fields[key] = extractFieldDefinition(fieldSchema as z.ZodType);
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
