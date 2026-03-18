# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MCP/U** (Model Context Protocol for Microcontrollers) is a system for making ESP32/Arduino hardware AI-controllable via the Model Context Protocol. It has three parts:

1. **`firmware/`** — Arduino/PlatformIO library (`McpIot`) that exposes GPIO and custom tools via JSON-RPC 2.0 over Serial or TCP
2. **`client/`** — TypeScript MCP server (`mcpu-client`) that dynamically discovers device tools via firmware introspection and registers them as MCP tools
3. **`docs-site/`** — Astro/Starlight documentation website (deployed to Vercel)

## Commands

### Client (TypeScript)
```bash
cd client
npm run build       # Compile TypeScript → dist/
npm run dev         # Run without building (tsx)
npm start           # Run compiled output
```

### Firmware (PlatformIO)
```bash
cd firmware
pio run                          # Build
pio run --target upload          # Build and flash to ESP32
pio device monitor               # Serial monitor
pio run -e esp32dev              # Build specific environment
```

### Docs Site (Astro)
```bash
cd docs-site
npm run dev      # Local dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Docs Site Architecture (`docs-site/`)

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build). Deployed to Vercel as a static site.

**Content lives in `src/content/docs/`** — all pages are Markdown/MDX:

| Path | Purpose |
|------|---------|
| `guides/getting-started.md` | Quick start (homepage flow) |
| `guides/firmware.md` | McpIot library usage |
| `guides/client.md` | mcpu-client setup |
| `guides/cli-agents.md` | Using with CLI agents |
| `reference/protocol.md` | JSON-RPC 2.0 protocol spec |
| `reference/architecture.md` | System architecture |
| `reference/compatibility.md` | Platform compatibility |

**Sidebar** is manually ordered in `astro.config.mjs` — update it when adding new pages.

**Deployed site**: `https://mcpu-2edge.vercel.app` (configured in `astro.config.mjs`). Vercel adapter is `@astrojs/vercel` with `output: 'static'`.

## Architecture

### Data Flow
```
LLM (Claude/etc.) ↔ MCP Protocol ↔ mcpu-client (TypeScript)
                                         ↕
                              SerialTransport | TcpTransport
                                         ↕
                              ESP32 firmware (McpIot library)
                                         ↕
                                   Physical GPIO / Sensors
```

### Client Architecture (`client/src/`)

- **`index.ts`** — MCP server entry point. Reads device config from env vars, calls `DeviceManager` to discover devices, then dynamically registers MCP tools and resources based on what each device reports.
- **`device_manager.ts`** — Manages N device connections. Calls `get_info` + `list_tools` on each device at startup to discover capabilities. Routes subsequent RPC calls by device ID.
- **`transport.ts`** — `BaseTransport` abstract class + `SerialTransport` (USB-UART via `serialport`) and `TcpTransport` (WiFi). Uses newline-delimited JSON framing. Factory function selects transport by config.
- **`schema_builder.ts`** — Converts firmware JSON Schema to Zod validation shapes for MCP tool registration.

### Firmware Architecture (`firmware/lib/McpIot/`)

- **`McpIot.h`** — Public API: `McpDevice` class, pin type enums, tool handler function signature
- **`McpIot.cpp`** — JSON-RPC 2.0 dispatcher. Built-in tools: `get_info`, `list_tools`, `gpio_write`, `gpio_read`, `pwm_write`, `adc_read`. User-registered tools dispatched via function pointers.

### Device Configuration

Devices are configured via environment variables in the client:
```
DEVICE_1_PORT=/dev/ttyUSB0      # Serial port
DEVICE_1_BAUD=115200            # Baud rate
DEVICE_1_HOST=192.168.1.100     # TCP host (alternative to serial)
DEVICE_1_TCP_PORT=3000          # TCP port
DEVICE_N_...                    # Additional devices (N=2,3,...)
```

### Protocol

JSON-RPC 2.0 over newline-delimited Serial or TCP. Firmware handles introspection (`get_info`, `list_tools`) and hardware control (`gpio_write`, `gpio_read`, `pwm_write`, `adc_read`). Custom tools registered via `McpDevice::registerTool()`.

## Key Design Decisions

- **Dynamic tool discovery**: No hardcoded tool names — the client discovers everything from the firmware at runtime via `list_tools`. This means adding a new tool on the firmware side requires no client changes.
- **Multi-device**: The client manages a pool of devices; each MCP tool name is prefixed with the device ID to avoid collisions.
- **Transport abstraction**: `BaseTransport` handles framing and JSON-RPC; subclasses handle the physical connection.
- **Examples live in `examples/`**: Each is a standalone PlatformIO project demonstrating a use case (LED, BME280, SSD1306, MPU6050, etc.).
