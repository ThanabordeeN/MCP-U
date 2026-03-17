#!/usr/bin/env node
/**
 * MCP-IoT Universal Client
 *
 * Connects to N MCU devices, discovers their tools via list_tools,
 * and dynamically registers MCP tools — zero hardcoded tool names.
 *
 * Config (priority order):
 *   1. DEVICES env var  "id:port:baud,id2:host:port:tcp"
 *   2. devices.json in the client/ directory
 *
 * Claude Desktop config:
 *   {
 *     "mcpServers": {
 *       "mcu": {
 *         "command": "node",
 *         "args": ["/absolute/path/to/client/dist/index.js"],
 *         "env": { "DEVICES": "esp32-01:/dev/ttyUSB0:115200" }
 *       }
 *     }
 *   }
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import { DeviceManager } from "./device_manager.js";
import { json_schema_to_zod } from "./schema_builder.js";
import type { DeviceConfig } from "./transport.js";

// ---------------------------------------------------------------------------
// Load device config
// ---------------------------------------------------------------------------

function load_devices(): DeviceConfig[] {
  if (process.env.SERIAL_PORT) {
    return [{
      id: "esp32",
      transport: "serial" as const,
      port: process.env.SERIAL_PORT,
      baud: Number(process.env.SERIAL_BAUD ?? 115200),
    }];
  }

  if (process.env.DEVICES) {
    return process.env.DEVICES.split(",").map((entry) => {
      const parts = entry.trim().split(":");
      const [id, port_or_host, baud_or_port, maybe_transport] = parts;
      const is_tcp = maybe_transport === "tcp" || (parts.length === 4 && maybe_transport === "tcp");
      if (is_tcp) {
        return { id, transport: "tcp" as const, host: port_or_host, port_num: Number(baud_or_port) };
      }
      return { id, transport: "serial" as const, port: port_or_host, baud: Number(baud_or_port ?? 115200) };
    });
  }

  const config_path = join(dirname(fileURLToPath(import.meta.url)), "..", "devices.json");
  try {
    return JSON.parse(readFileSync(config_path, "utf8")) as DeviceConfig[];
  } catch {
    throw new Error(`No device config found. Set DEVICES env var or create devices.json`);
  }
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
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "mcu-iot", version: "1.0.0" });

// ---------------------------------------------------------------------------
// Meta tool — always present
// ---------------------------------------------------------------------------

server.registerTool(
  "list_devices",
  { description: "List all connected MCUs with their tools and pin registry" },
  async () => ({
    content: [{ type: "text" as const, text: JSON.stringify(manager.list().map(({ id, info, pins, tools }) => ({ id, info, pins, tools })), null, 2) }],
  })
);

// ---------------------------------------------------------------------------
// Dynamic tool registration — one MCP tool per device×tool combo
// ---------------------------------------------------------------------------

for (const device of all_devices) {
  for (const tool of device.tools) {
    // Naming: no prefix for single device, double-underscore prefix for multi
    const mcp_name = multi_device ? `${device.id}__${tool.name}` : tool.name;

    const zod_shape = {
      ...(multi_device
        ? { device_id: z.literal(device.id).describe(`Target device (${device.id})`) }
        : {}),
      ...json_schema_to_zod(tool.inputSchema),
    };

    server.registerTool(
      mcp_name,
      {
        description: multi_device
          ? `[${device.id}] ${tool.description}`
          : tool.description,
        inputSchema: zod_shape,
      },
      async (args: Record<string, unknown>) => {
        const { device_id: _device_id, ...params } = args;
        const result = await manager.call(device.id, tool.name, params as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.registerResource(
  "mcu-devices",
  "mcu://devices",
  { mimeType: "application/json", description: "All connected MCUs with their tool and pin registries" },
  async () => ({
    contents: [{
      uri:      "mcu://devices",
      mimeType: "application/json",
      text:     JSON.stringify(manager.list().map(({ id, info, pins, tools }) => ({ id, info, pins, tools })), null, 2),
    }],
  })
);

server.registerResource(
  "mcu-device-pins",
  new ResourceTemplate("mcu://{device_id}/pins", { list: undefined }),
  { mimeType: "application/json", description: "Pin registry for a specific MCU" },
  async (uri, { device_id }) => {
    const device = manager.list().find((d) => d.id === device_id);
    if (!device) throw new Error(`Unknown device: ${device_id}`);
    return {
      contents: [{
        uri:      uri.href,
        mimeType: "application/json",
        text:     JSON.stringify({ id: device.id, info: device.info, pins: device.pins }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);

process.on("SIGINT",  () => { manager.close_all(); process.exit(0); });
process.on("SIGTERM", () => { manager.close_all(); process.exit(0); });
