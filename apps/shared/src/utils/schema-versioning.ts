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
 * Strip away Zod wrapper types (Optional, Nullable, Default, Effects, Branded,
 * Pipeline, Lazy, Readonly) to reach the *inner* schema that carries the
 * structural information.
 *
 * IMPORTANT: `current` is always initialised from a concrete schema argument,
 * and the while-loop body only assigns from known `_def` properties.  The
 * `else` branch explicitly breaks, so `current` can never be `undefined` when
 * we return.  This satisfies `noUncheckedIndexedAccess`-adjacent narrowing.
 */
export function unwrapZodSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current: z.ZodTypeAny = schema;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // ---- Wrappers that have .innerType ----
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      current = (current as z.ZodOptional<z.ZodTypeAny>)._def.innerType;
    } else if (current instanceof z.ZodDefault) {
      current = (current as z.ZodDefault<z.ZodTypeAny>)._def.innerType;
    } else if (current instanceof z.ZodEffects) {
      current = (current as z.ZodEffects<z.ZodTypeAny>)._def.schema;
    }
    // ---- Pipeline ----
    else if (current instanceof z.ZodPipeline) {
      // Prefer the *output* type as it represents the validated shape.
      current = (current as z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>)._def
        .out;
    }
    // ---- Branded ----
    else if (current instanceof z.ZodBranded) {
      current = (current as z.ZodBranded<z.ZodTypeAny, string>)._def.type;
    }
    // ---- Readonly ----
    else if (current instanceof z.ZodReadonly) {
      current = (current as z.ZodReadonly<z.ZodTypeAny>)._def.innerType;
    }
    // ---- Lazy (resolve once) ----
    else if (current instanceof z.ZodLazy) {
      const resolved: z.ZodTypeAny = (
        current as z.ZodLazy<z.ZodTypeAny>
      )._def.getter();
      // Guard against accidental infinite loops.
      if (resolved === current) break;
      current = resolved;
    }
    // ---- Base case – nothing left to unwrap ----
    else {
      break;
    }
  }

  // `current` is guaranteed to be defined because we started with a concrete
  // schema and every branch either reassigns or breaks.
  return current;
}

// ---------------------------------------------------------------------------
// Field-definition extraction
// ---------------------------------------------------------------------------

/**
 * Walk a (possibly wrapped) Zod schema and produce a {@link FieldDefinition}.
 */
export function extractFieldDefinition(schema: z.ZodTypeAny): FieldDefinition {
  const inner = unwrapZodSchema(schema);
  const required =
    !(schema instanceof z.ZodOptional) &&
    !(schema instanceof z.ZodNullable) &&
    !(schema instanceof z.ZodDefault);

  const base: FieldDefinition = {
    type: (inner._def as z.ZodTypeDef & { typeName: string }).typeName,
    required,
    description:
      "description" in inner
        ? (inner.description as string | undefined)
        : undefined,
  };

  // ---- Object ----
  if (inner instanceof z.ZodObject) {
    const shape = inner._def.shape() as Record<string, z.ZodTypeAny>;
    const fields: Record<string, FieldDefinition> = {};
    for (const key of Object.keys(shape)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const fieldSchema: z.ZodTypeAny | undefined = shape[key];
      if (fieldSchema) {
        fields[key] = extractFieldDefinition(fieldSchema);
      }
    }
    base.fields = fields;
  }

  // ---- Array ----
  if (inner instanceof z.ZodArray) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const elementSchema: z.ZodTypeAny = inner._def.type;
    base.element = extractFieldDefinition(elementSchema);
  }

  // ---- Union / DiscriminatedUnion ----
  if (
    inner instanceof z.ZodUnion ||
    inner instanceof z.ZodDiscriminatedUnion
  ) {
    const options: FieldDefinition[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const opts: readonly z.ZodTypeAny[] = inner._def.options;
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
  const shape = schema._def.shape() as Record<string, z.ZodTypeAny>;
  const fields: Record<string, FieldDefinition> = {};

  for (const key of Object.keys(shape)) {
    // With noUncheckedIndexedAccess, bracket access on Record<K,V> returns
    // V | undefined – guard that explicitly.
    const fieldSchema: z.ZodTypeAny | undefined = shape[key];
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
    diffs.push(`${prefix}: type changed from "${snapshot.type}" to "${current.type}"`);
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
      diffs.push(...compareFieldDefinition(currentField, snapshotField, nestedPath));
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
        diffs.push(
          ...compareFieldDefinition(c, s, `${prefix}[union@${i}]`),
        );
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
