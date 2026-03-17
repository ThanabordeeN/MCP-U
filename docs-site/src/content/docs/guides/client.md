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

All configuration is done via environment variables.

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `SERIAL_PORT` | Serial port — single device shorthand | — | `/dev/ttyACM0`, `COM3` |
| `SERIAL_BAUD` | Baud rate (used with `SERIAL_PORT`) | `115200` | `9600` |
| `DEVICES` | Multi-device config string | — | `esp32:/dev/ttyACM0:115200` |

Priority: `SERIAL_PORT` → `DEVICES`

---

## Configuration

### Single Device — `SERIAL_PORT`

```bash
SERIAL_PORT=/dev/ttyACM0 npx mcpu-client
```

Custom baud rate:
```bash
SERIAL_PORT=/dev/ttyACM0 SERIAL_BAUD=9600 npx mcpu-client
```

### Multiple Devices — `DEVICES`

Format: `id:port:baud` (serial) or `id:host:port:tcp` (TCP), comma-separated.

```bash
# Two serial devices
DEVICES=robot:/dev/ttyUSB0:115200,display:/dev/ttyACM0:115200 npx mcpu-client

# Serial + TCP
DEVICES=robot:/dev/ttyUSB0:115200,sensor:192.168.1.50:3000:tcp npx mcpu-client

# Windows
set DEVICES=board1:COM3:115200,board2:COM4:115200 && npx mcpu-client
```

With multiple devices, tools are prefixed: `robot__gpio_write`, `display__gpio_write`

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

Multi-device:
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "DEVICES": "robot:/dev/ttyUSB0:115200,display:/dev/ttyACM0:115200"
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
# Single device
claude mcp add mcpu -e SERIAL_PORT=/dev/ttyACM0 -- npx mcpu-client

# Multiple devices
claude mcp add mcpu -e DEVICES=robot:/dev/ttyUSB0:115200,display:/dev/ttyACM0:115200 -- npx mcpu-client
```

---

## Gemini CLI

Edit `~/.gemini/settings.json`:

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

| OS | Command | Typical port |
|----|---------|-------------|
| Linux | `ls /dev/ttyUSB* /dev/ttyACM*` | `/dev/ttyACM0` |
| macOS | `ls /dev/tty.usbserial-*` | `/dev/tty.usbserial-*` |
| Windows | Device Manager → Ports | `COM3`, `COM4` |

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

---

## Dynamic Tool Discovery

The client has **zero hardcoded tool names**. On startup:

1. Connects to all configured devices
2. Calls `get_info` + `list_tools` on each
3. Converts firmware JSON Schema → Zod schemas at runtime
4. Registers one MCP tool per firmware tool

Adding a new tool to firmware = the MCP tool appears automatically on next client restart.

| Scenario | Tool name format | Example |
|----------|-----------------|---------|
| Single device | `{tool_name}` | `gpio_write` |
| Multi device | `{device_id}__{tool_name}` | `robot__gpio_write` |
