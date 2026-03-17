---
title: Client Setup
description: Install and configure the MCP/U client to connect AI agents to your MCUs.
---

## Installation

The client is published on npm — no local setup needed:

```bash
npx mcpu-client
```

Or install globally:

```bash
npm install -g mcpu-client
```

---

## Environment Variables

All configuration is done via environment variables. Priority order: `SERIAL_PORT` → `DEVICES` → `devices.json`

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SERIAL_PORT` | Serial port for a single device | — | `/dev/ttyACM0`, `COM3` |
| `SERIAL_BAUD` | Baud rate (used with `SERIAL_PORT`) | `115200` | `9600` |
| `DEVICES` | Multi-device config string (see format below) | — | `esp32:/dev/ttyUSB0:115200` |

---

## Configuration

### Option 1 — `SERIAL_PORT` (recommended for single device)

Set one environment variable — the client handles the rest.

```bash
SERIAL_PORT=/dev/ttyACM0 npx mcpu-client
```

Custom baud rate:
```bash
SERIAL_PORT=/dev/ttyACM0 SERIAL_BAUD=9600 npx mcpu-client
```

### Option 2 — `DEVICES` (multi-device or TCP)

Format: `id:port:baud` (serial) or `id:host:port:tcp` (TCP), comma-separated.

```bash
# Single serial device
DEVICES=esp32-01:/dev/ttyUSB0:115200 npx mcpu-client

# Multiple devices
DEVICES=robot:/dev/ttyUSB0:115200,sensor:192.168.1.50:3000:tcp npx mcpu-client

# Windows
set DEVICES=esp32-01:COM3:115200 && npx mcpu-client
```

### Option 3 — `devices.json`

When running locally (cloned repo), create `client/devices.json`:

```json
[
  {
    "id": "esp32-01",
    "transport": "serial",
    "port": "/dev/ttyACM0",
    "baud": 115200
  },
  {
    "id": "greenhouse",
    "transport": "tcp",
    "host": "192.168.1.50",
    "port_num": 3000
  }
]
```

Priority: `SERIAL_PORT` → `DEVICES` → `devices.json`

---

## Claude Desktop Integration

**Linux / macOS** — `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "SERIAL_PORT": "/dev/ttyACM0"
      }
    }
  }
}
```

**Windows** — `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "SERIAL_PORT": "COM3"
      }
    }
  }
}
```

---

## Claude Code (CLI)

```bash
claude mcp add mcpu -e SERIAL_PORT=/dev/ttyACM0 -- npx mcpu-client
```

Verify:
```bash
claude mcp list
```

---

## Gemini CLI

```bash
gemini mcp add mcpu npx mcpu-client
```

Then add `env` in `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "SERIAL_PORT": "/dev/ttyACM0"
      }
    }
  }
}
```

---

## Finding Your Serial Port

**Linux:**
```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

**macOS:**
```bash
ls /dev/tty.usbserial-*
```

**Windows:** Device Manager → Ports (COM & LPT)

**Permission error on Linux:**
```bash
sudo usermod -aG dialout $USER
# Log out and back in
```

---

## Testing with MCP Inspector

```bash
SERIAL_PORT=/dev/ttyACM0 npx @modelcontextprotocol/inspector npx mcpu-client
```

Open the browser URL shown. You can:
- Browse dynamically discovered tools
- Call `list_devices` to see connected MCUs
- Call `gpio_write` / `gpio_read` interactively

---

## Dynamic Tool Discovery

The client has **zero hardcoded tool names**. On startup:

1. Connects to all configured devices
2. Calls `get_info` + `list_tools` on each
3. Converts firmware JSON Schema → Zod schemas at runtime
4. Registers one MCP tool per firmware tool

Adding a new tool to firmware = the MCP tool appears automatically on next client restart.

### Tool Naming

| Scenario | Tool name format | Example |
|----------|-----------------|---------|
| Single device | `{tool_name}` | `gpio_write` |
| Multi device | `{device_id}__{tool_name}` | `robot__gpio_write` |

---

## Multi-Device Setup

```json
[
  { "id": "robot-arm",   "transport": "serial", "port": "/dev/ttyUSB0", "baud": 115200 },
  { "id": "greenhouse",  "transport": "serial", "port": "/dev/ttyUSB1", "baud": 115200 },
  { "id": "display-esp", "transport": "tcp",    "host": "192.168.1.50", "port_num": 3000 }
]
```

With multiple devices, tools are named `{device_id}__{tool_name}` (e.g. `robot-arm__gpio_write`).
