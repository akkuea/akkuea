import { z } from "zod";

/**
 * Structural definition of a schema field for version snapshotting
 */
export interface SchemaFieldDefinition {
  type: string;
  isOptional: boolean;
  properties?: Record<string, SchemaFieldDefinition>;
  element?: SchemaFieldDefinition;
}

/**
 * Metadata wrapper for a schema snapshot
 */
export interface SchemaSnapshot {
  version: string;
  schemas: Record<string, SchemaFieldDefinition>;
}

/**
 * Result of a schema snapshot comparison
 */
export interface SchemaComparisonResult {
  compatible: boolean;
  errors: string[];
}

/**
 * Unwraps Zod schema wrappers (optional, nullable, default, effects) to find the core schema
 */
function unwrapZodSchema(schema: z.ZodTypeAny): {
  coreSchema: z.ZodTypeAny;
  isOptional: boolean;
} {
  let current: z.ZodTypeAny = schema;
  let isOptional = false;

  while (current) {
    const typeName = current._def?.typeName;
    if (typeName === "ZodOptional" || typeName === "ZodNullable") {
      isOptional = true;
      current = (current._def as { innerType: z.ZodTypeAny }).innerType;
    } else if (typeName === "ZodDefault") {
      isOptional = true;
      current = (current._def as { innerType: z.ZodTypeAny }).innerType;
    } else if (typeName === "ZodEffects") {
      current = (current._def as { schema: z.ZodTypeAny }).schema;
    } else if (typeName === "ZodPipeline") {
      current = (current._def as { out: z.ZodTypeAny }).out;
    } else {
      break;
    }
  }

  return { coreSchema: current, isOptional };
}

/**
 * Extracts a structural field definition from a Zod schema
 */
export function extractSchemaShape(schema: z.ZodTypeAny): SchemaFieldDefinition {
  const { coreSchema, isOptional } = unwrapZodSchema(schema);
  const typeName = coreSchema._def?.typeName || "Unknown";

  if (typeName === "ZodObject") {
    const shape = (coreSchema as z.ZodObject<z.ZodRawShape>).shape;
    const properties: Record<string, SchemaFieldDefinition> = {};
    for (const key of Object.keys(shape)) {
      properties[key] = extractSchemaShape(shape[key]);
    }
    return {
      type: "ZodObject",
      isOptional,
      properties,
    };
  }

  if (typeName === "ZodArray") {
    const elementType = (coreSchema as z.ZodArray<z.ZodTypeAny>).element;
    return {
      type: "ZodArray",
      isOptional,
      element: extractSchemaShape(elementType),
    };
  }

  return {
    type: typeName,
    isOptional,
  };
}

/**
 * Recursively compares a current schema field definition against a snapshot definition
 */
function compareFieldDefinition(
  current: SchemaFieldDefinition,
  snapshot: SchemaFieldDefinition,
  path: string
): string[] {
  const errors: string[] = [];

  // Check type compatibility
  if (current.type !== snapshot.type) {
    errors.push(
      `Field '${path}' type changed from '${snapshot.type}' to '${current.type}'`
    );
    return errors;
  }

  // Check optionality changes
  if (snapshot.isOptional && !current.isOptional) {
    errors.push(`Field '${path}' became required (was optional in snapshot)`);
  }

  if (!snapshot.isOptional && current.isOptional) {
    errors.push(`Field '${path}' became optional (was required in snapshot)`);
  }

  // Compare ZodObject properties
  if (current.type === "ZodObject") {
    const snapshotProps = snapshot.properties || {};
    const currentProps = current.properties || {};

    // 1. All snapshot properties must exist in current schema and be compatible
    for (const key of Object.keys(snapshotProps)) {
      const fieldPath = path ? `${path}.${key}` : key;
      if (!(key in currentProps)) {
        errors.push(`Required field '${fieldPath}' from snapshot was removed`);
      } else {
        errors.push(
          ...compareFieldDefinition(
            currentProps[key],
            snapshotProps[key],
            fieldPath
          )
        );
      }
    }

    // 2. Any new properties in current schema must be optional
    for (const key of Object.keys(currentProps)) {
      const fieldPath = path ? `${path}.${key}` : key;
      if (!(key in snapshotProps)) {
        if (!currentProps[key].isOptional) {
          errors.push(
            `New required field '${fieldPath}' added without updating snapshot`
          );
        }
      }
    }
  }

  // Compare ZodArray elements
  if (current.type === "ZodArray" && snapshot.element && current.element) {
    errors.push(
      ...compareFieldDefinition(
        current.element,
        snapshot.element,
        `${path}[]`
      )
    );
  }

  return errors;
}

/**
 * Validates a map of current Zod schemas against a versioned snapshot
 */
export function validateSchemaSnapshot(
  schemas: Record<string, z.ZodTypeAny>,
  snapshot: SchemaSnapshot
): SchemaComparisonResult {
  const errors: string[] = [];

  for (const [schemaName, snapshotShape] of Object.entries(snapshot.schemas)) {
    const currentZodSchema = schemas[schemaName];
    if (!currentZodSchema) {
      errors.push(`Schema '${schemaName}' defined in snapshot is missing`);
      continue;
    }

    const currentShape = extractSchemaShape(currentZodSchema);
    const fieldErrors = compareFieldDefinition(
      currentShape,
      snapshotShape,
      schemaName
    );
    errors.push(...fieldErrors);
  }

  return {
    compatible: errors.length === 0,
    errors,
  };
}
