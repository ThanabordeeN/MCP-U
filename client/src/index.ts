#!/usr/bin/env node
/**
 * MCP/U Client — by 2edge.co
 *
 * Connects to MCU devices, discovers tools via list_tools,
 * and dynamically registers MCP tools — zero hardcoded tool names.
 *
 * Config (priority order):
 *   1. SERIAL_PORT env var  (single device shorthand)
 *   2. DEVICES env var      "id:port:baud,id2:host:port:tcp"
 */

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import crypto from "crypto";
import { DeviceManager } from "./device_manager.js";
import {
  builtin_fallback_schema,
  json_schema_to_zod,
} from "./schema_builder.js";
import type { DeviceConfig } from "./transport.js";
import {
  config as memConfig,
  SqliteMemoryStore,
  BufferDrainPoller,
  SqliteReadonlyAdapter,
  BufferedPin,
} from "./memory/index.js";

// ---------------------------------------------------------------------------
// Load device config
// ---------------------------------------------------------------------------

function load_devices(): DeviceConfig[] {
  if (process.env.SERIAL_PORT) {
    return [
      {
        id: "esp32",
        transport: "serial" as const,
        port: process.env.SERIAL_PORT,
        baud: Number(process.env.SERIAL_BAUD ?? 115200),
      },
    ];
  }

  if (process.env.DEVICES) {
    return process.env.DEVICES.split(",").map((entry) => {
      const parts = entry.trim().split(":");
      const [id, port_or_host, baud_or_port, maybe_transport] = parts;
      const is_tcp =
        maybe_transport === "tcp" ||
        (parts.length === 4 && maybe_transport === "tcp");
      if (is_tcp) {
        return {
          id,
          transport: "tcp" as const,
          host: port_or_host,
          port_num: Number(baud_or_port),
        };
      }
      return {
        id,
        transport: "serial" as const,
        port: port_or_host,
        baud: Number(baud_or_port ?? 115200),
      };
    });
  }

  throw new Error(
    "No device config found. Set SERIAL_PORT or DEVICES env var.",
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

const device_configs = load_devices();
const manager = new DeviceManager(device_configs);

try {
  await manager.connect_all();
} catch (err) {
  process.stderr.write(`[mcu-mcp] ${(err as Error).message}\n`);
  process.exit(1);
}

const all_devices = manager.list();
const multi_device = all_devices.length > 1;

// ---------------------------------------------------------------------------
// Memory Subsystem
// ---------------------------------------------------------------------------

const sessionId = crypto.randomUUID();
let memory: SqliteMemoryStore | null = null;
let readonlyAdapter: SqliteReadonlyAdapter | null = null;
let poller: BufferDrainPoller | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let memoryInitError: string | null = null;

if (memConfig.MEMORY_ENABLED) {
  try {
    memory = new SqliteMemoryStore();
    await memory.connect();

    await memory.writeSession({
      session_id: sessionId,
      started_at_ms: Date.now(),
      client_version: "1.2.0",
      memory_profile: "balanced",
    });

    for (const device of all_devices) {
      await memory.writeDevice({
        device_id: device.id,
        session_id: sessionId,
        device_name: device.info.device ?? "unknown",
        firmware_version: device.info.version ?? "unknown",
        platform: device.info.platform ?? "unknown",
        transport_type: "unknown", // can be filled properly if tracking transport info
        transport_address: "unknown",
        discovered_at_ms: Date.now(),
        info_json: JSON.stringify(device.info),
      });

      for (const pin of device.pins) {
        await memory.writeResource({
          resource_id: `${device.id}:${pin.name}`,
          session_id: sessionId,
          device_id: device.id,
          resource_name: pin.name,
          resource_type: pin.type,
          direction: "unknown",
          pin: pin.pin,
          unit: null,
          data_type: "number",
          description: pin.description,
          sampling_enabled: pin.sampling?.interval_ms ? 1 : 0,
          sampling_interval_ms: pin.sampling?.interval_ms ?? null,
          buffer_enabled: pin.capabilities?.buffer ? 1 : 0,
          buffer_size: pin.sampling?.buffer_size ?? null,
          metadata_json: null,
          created_at_ms: Date.now(),
        });
      }
    }

    readonlyAdapter = new SqliteReadonlyAdapter(
      memConfig.MEMORY_CONNECTION_URL.replace("sqlite:///", "")
    );

    if (memConfig.BUFFER_DRAIN_ENABLED) {
      poller = new BufferDrainPoller(manager, memory, {
        sessionId,
        drainRatio: memConfig.BUFFER_DRAIN_RATIO,
        minIntervalMs: memConfig.BUFFER_DRAIN_MIN_INTERVAL_MS,
      });

      const bufferedPins: BufferedPin[] = [];
      for (const device of all_devices) {
        for (const pin of device.pins) {
          if (
            pin.capabilities?.buffer &&
            pin.sampling?.interval_ms &&
            pin.sampling?.buffer_size
          ) {
            bufferedPins.push({
              device_id: device.id,
              resource_name: pin.name,
              pin: pin.pin,
              sample_interval_ms: pin.sampling.interval_ms,
              buffer_size: pin.sampling.buffer_size,
              drain_ratio: memConfig.BUFFER_DRAIN_RATIO,
              drain_interval_ms: 0,
            });
          }
        }
      }

      if (bufferedPins.length > 0) {
        poller.start(bufferedPins);
        process.stderr.write(
          `[memory] Started poller for ${bufferedPins.length} buffered pins\n`
        );
      }
    }

    cleanupInterval = setInterval(async () => {
      try {
        await memory?.cleanup();
      } catch (err) {
        process.stderr.write(`[memory] Cleanup failed: ${(err as Error).message}\n`);
      }
    }, 60_000);
  } catch (err) {
    memoryInitError = (err as Error).message;
    process.stderr.write(`[memory] Failed to initialize: ${memoryInitError}\n${(err as Error).stack}\n`);
    memory = null;
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "MCP-U", version: "1.2.0" });

// ---------------------------------------------------------------------------
// Meta tool — always present
// ---------------------------------------------------------------------------

server.registerTool(
  "list_devices",
  { description: "List all connected MCUs with their tools and pin registry" },
  async () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          manager
            .list()
            .map(({ id, info, pins, tools }) => ({ id, info, pins, tools })),
          null,
          2,
        ),
      },
    ],
  }),
);

// ---------------------------------------------------------------------------
// Memory tools — always registered, null-safe handlers
// ---------------------------------------------------------------------------

{
  server.registerTool(
    "sql_readonly_query",
    {
      description: "Allows LLM to query cached MCP-U memory using SELECT/WITH SQL only.",
      inputSchema: z.object({
        sql: z.string().describe("The readonly SQL query (SELECT/WITH only)."),
        max_rows: z.number().optional().describe("Max rows to return (default 500)."),
      }),
    },
    async (args: any) => {
      if (!readonlyAdapter) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Memory not initialized", reason: memoryInitError ?? "unknown" }) }],
          isError: true,
        };
      }
      try {
        const result = await readonlyAdapter.query(
          args.sql,
          args.max_rows ?? memConfig.SQL_MAX_ROWS
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: (err as Error).message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "memory_status",
    {
      description: "Returns memory driver, retention, row count, poller status, and active buffered pins.",
      inputSchema: z.object({}),
    },
    async () => {
      if (!memory) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Memory not initialized" }) }],
          isError: true,
        };
      }
      const status = await memory.getStatus();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
      };
    }
  );

  server.registerResource(
    "mcu-cache-schema",
    "mcu://cache/schema",
    {
      mimeType: "text/plain",
      description: "Database schema for MCP-U memory",
    },
    async () => {
      const { schemaSQL } = await import("./memory/schema.js");
      return {
        contents: [
          { uri: "mcu://cache/schema", mimeType: "text/plain", text: schemaSQL },
        ],
      };
    }
  );

  server.registerResource(
    "mcu-cache-status",
    "mcu://cache/status",
    {
      mimeType: "application/json",
      description: "Memory status and configuration",
    },
    async () => {
      const status = memory
        ? await memory.getStatus()
        : { error: "Memory not initialized" };
      return {
        contents: [
          {
            uri: "mcu://cache/status",
            mimeType: "application/json",
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    "mcu-cache-examples",
    "mcu://cache/examples",
    {
      mimeType: "text/plain",
      description: "Example SQL queries for MCP-U memory",
    },
    async () => ({
      contents: [
        {
          uri: "mcu://cache/examples",
          mimeType: "text/plain",
          text: `
-- Latest Observations
SELECT device_id, resource_name, value_num, unit, timestamp_ms
FROM latest_observations LIMIT 20;

-- Device Signal Summary
SELECT device_id, resource_name, sample_count, min_value, max_value, avg_value
FROM device_signal_summary ORDER BY sample_count DESC;

-- Buffer Drain Health
SELECT device_id, resource_name, drain_count, ok_count, error_count, avg_latency_ms, last_completed_at_ms
FROM buffer_drain_health;
          `.trim(),
        },
      ],
    })
  );
}

// ---------------------------------------------------------------------------
// Dynamic tool registration — one MCP tool per device×tool combo
// ---------------------------------------------------------------------------

for (const device of all_devices) {
  for (const tool of device.tools) {
    // Naming: no prefix for single device, double-underscore prefix for multi
    const mcp_name = multi_device ? `${device.id}__${tool.name}` : tool.name;

    const firmware_shape = json_schema_to_zod(tool.inputSchema);
    const fallback_shape =
      Object.keys(firmware_shape).length === 0
        ? builtin_fallback_schema(tool.name)
        : {};

    const zod_shape = {
      ...(multi_device
        ? {
            device_id: z
              .literal(device.id)
              .describe(`Target device (${device.id})`),
          }
        : {}),
      ...fallback_shape,
      ...firmware_shape,
    };

    server.registerTool(
      mcp_name,
      {
        description: multi_device
          ? `[${device.id}] ${tool.description}`
          : tool.description,
        inputSchema: z.object(zod_shape).passthrough(),
      },
      async (args: Record<string, unknown>) => {
        const { device_id: _device_id, ...params } = args;
        const started_at_ms = Date.now();
        let resultJson: string | null = null;
        let errorJson: string | null = null;
        let status = "ok";
        let result: unknown;

        try {
          result = await manager.call(
            device.id,
            tool.name,
            params as Record<string, unknown>,
          );
          resultJson = JSON.stringify(result);
          
          // ADDITIONALS feature: custom tool buffer support opt-in
          if (
            memory && 
            result && 
            typeof result === "object" && 
            (result as any).type === "buffer" && 
            Array.isArray((result as any).values)
          ) {
            const bufRes = result as any;
            const rows = (await import("./memory/buffer_expander.js")).expandBufferSamples({
              values: bufRes.values,
              receivedAtMs: Date.now(),
              sampleIntervalMs: bufRes.sample_interval_ms ?? 1000,
              sessionId,
              deviceId: device.id,
              resourceName: bufRes.resource ?? tool.name,
              bufferBatchId: `custom_drain_${device.id}_${tool.name}_${Date.now()}`,
            });
            // Update source and observation_type
            rows.forEach(r => {
              r.source = `custom:${tool.name}`;
              r.observation_type = "custom_buffer_drain";
            });
            await memory.writeObservations(rows);
          }

        } catch (err) {
          status = "error";
          errorJson = JSON.stringify({ message: (err as Error).message });
          throw err;
        } finally {
          const completed_at_ms = Date.now();
          if (memory) {
            await memory.writeToolCall({
              session_id: sessionId,
              device_id: device.id,
              tool_name: tool.name,
              tool_kind: "builtin",
              call_source: "llm",
              params_json: JSON.stringify(params),
              result_json: resultJson,
              error_json: errorJson,
              status,
              latency_ms: completed_at_ms - started_at_ms,
              started_at_ms,
              completed_at_ms,
              metadata_json: null,
            });
          }
        }

        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
        };
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Auto-poll custom tools based on firmware-declared polling intervals
// ---------------------------------------------------------------------------

for (const device of all_devices) {
  for (const tool of device.tools) {
    if (tool.polling?.enabled && tool.polling.interval_ms > 0) {
      const interval_ms = tool.polling.interval_ms;
      process.stderr.write(
        `[auto-poll] ${device.id}::${tool.name} every ${interval_ms}ms (firmware-declared)\n`
      );
      setInterval(async () => {
        try {
          const result = await manager.call(device.id, tool.name, {});
          if (
            memory &&
            result &&
            typeof result === "object" &&
            (result as any).type === "buffer" &&
            Array.isArray((result as any).values)
          ) {
            const bufRes = result as any;
            const { expandBufferSamples } = await import("./memory/buffer_expander.js");
            const rows = expandBufferSamples({
              values: bufRes.values,
              receivedAtMs: Date.now(),
              sampleIntervalMs: bufRes.sample_interval_ms ?? 1000,
              sessionId,
              deviceId: device.id,
              resourceName: bufRes.resource ?? tool.name,
              bufferBatchId: `auto_poll_${device.id}_${tool.name}_${Date.now()}`,
            });
            rows.forEach((r: any) => {
              r.source = "auto_poll";
              r.observation_type = "auto_poll";
            });
            await memory.writeObservations(rows);
          }
        } catch (e) {
          process.stderr.write(
            `[auto-poll] ${tool.name} error: ${(e as Error).message}\n`
          );
        }
      }, interval_ms);
    }
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.registerResource(
  "mcu-devices",
  "mcu://devices",
  {
    mimeType: "application/json",
    description: "All connected MCUs with their tool and pin registries",
  },
  async () => ({
    contents: [
      {
        uri: "mcu://devices",
        mimeType: "application/json",
        text: JSON.stringify(
          manager
            .list()
            .map(({ id, info, pins, tools }) => ({ id, info, pins, tools })),
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerResource(
  "mcu-device-pins",
  new ResourceTemplate("mcu://{device_id}/pins", { list: undefined }),
  {
    mimeType: "application/json",
    description: "Pin registry for a specific MCU",
  },
  async (uri, { device_id }) => {
    const device = manager.list().find((d) => d.id === device_id);
    if (!device) throw new Error(`Unknown device: ${device_id}`);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { id: device.id, info: device.info, pins: device.pins },
            null,
            2,
          ),
        },
      ],
    };
  },
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT", () => {
  if (cleanupInterval) clearInterval(cleanupInterval);
  poller?.stop();
  memory?.close();
  manager.close_all();
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (cleanupInterval) clearInterval(cleanupInterval);
  poller?.stop();
  memory?.close();
  manager.close_all();
  process.exit(0);
});
