/**
 * schema_builder.ts — Converts firmware JSON Schema to a Zod shape.
 *
 * MCU firmware only produces flat schemas with primitive types, so this
 * converter is intentionally minimal — no $ref, no nested objects, no arrays.
 */

import { z } from "zod";

interface SchemaProp {
  type: string;
  description?: string;
}

interface InputSchema {
  type?: string;
  properties?: Record<string, SchemaProp>;
  required?: string[];
}

// Maps JSON Schema primitive types → Zod builders
const TYPE_MAP: Record<string, (prop: SchemaProp) => z.ZodTypeAny> = {
  integer: (p) => z.number().int().describe(p.description ?? ""),
  number:  (p) => z.number().describe(p.description ?? ""),
  boolean: (p) => z.boolean().describe(p.description ?? ""),
  string:  (p) => z.string().describe(p.description ?? ""),
};

/**
 * Convert a firmware inputSchema object to a Zod raw shape.
 * Unknown types are silently skipped.
 */
export function json_schema_to_zod(
  input_schema?: InputSchema
): Record<string, z.ZodTypeAny> {
  if (!input_schema?.properties) return {};

  const required = new Set(input_schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(input_schema.properties)) {
    const builder = TYPE_MAP[prop.type];
    if (!builder) continue;
    let field = builder(prop);
    if (!required.has(key)) field = field.optional() as z.ZodTypeAny;
    shape[key] = field;
  }

  return shape;
}
