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

/**
 * Built-in fallback schemas for low-memory firmware that omits inputSchema.
 * AVR builds intentionally skip schema emission to save heap, but the MCP SDK
 * strips arguments when a tool is registered with an empty object schema.
 */
export function builtin_fallback_schema(
  tool_name: string
): Record<string, z.ZodTypeAny> {
  const pin_number = z.number().int().describe("GPIO pin number");
  const pin_ref = z
    .union([z.string(), z.number().int()])
    .describe("Pin name or GPIO pin number");

  switch (tool_name) {
    case "gpio_write":
      return {
        pin: pin_number,
        value: z.boolean().describe("true = HIGH, false = LOW"),
      };
    case "gpio_read":
    case "adc_read":
      return { pin: pin_number };
    case "pwm_write":
      return {
        pin: pin_number,
        duty: z.number().int().describe("Duty cycle 0-255"),
      };
    case "get_pin_summary":
    case "get_pin_events":
      return { pin: pin_ref };
    case "get_pin_buffer":
      return {
        pin: pin_ref,
        limit: z.number().int().optional().describe("Max samples to return"),
      };
    default:
      return {};
  }
}
