---
title: Quick Start
description: Flash firmware, start the client, and connect Claude to your MCU in minutes.
---

## Prerequisites

- ESP32 board (or any Arduino-compatible MCU)
- [PlatformIO](https://platformio.org) or Arduino IDE
- Node.js 18+
- Claude Desktop or any MCP-compatible agent (Claude Code, Gemini CLI, etc.)

---

## Step 1 — Flash Firmware

Clone the repo and flash the example firmware:

```bash
git clone https://github.com/ThanabordeeN/mcpu
cd mcpu/firmware
pio run -t upload
```

Or open `firmware/` in Arduino IDE and upload `src/main.cpp`.

The default example exposes:
- GPIO 2 — `led` (digital output)
- GPIO 5 — `buzzer` (digital output)
- GPIO 34 — `sensor` (ADC input)

---

## Step 2 — Find your serial port

**Linux:**
```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

**macOS:**
```bash
ls /dev/tty.usbserial-*
```

**Windows:** Device Manager → Ports (COM & LPT)

---

## Step 3 — Add to your AI agent

The MCP/U client is published on npm — no local clone needed.

### Claude Desktop

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

### Claude Code (CLI)

```bash
claude mcp add mcpu -e SERIAL_PORT=/dev/ttyACM0 -- npx mcpu-client
```

### Gemini CLI

```bash
gemini mcp add mcpu npx mcpu-client
```

Then edit `~/.gemini/settings.json`:

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

Restart Claude Desktop / your agent. Claude can now control your MCU.

---

## Verify with MCP Inspector

```bash
SERIAL_PORT=/dev/ttyACM0 npx @modelcontextprotocol/inspector npx mcpu-client
```

Open the browser URL shown and try calling `list_devices` or `gpio_write`.

---

## Next Steps

- [Firmware Guide](/mcpu/guides/firmware/) — full `McpIot` API reference
- [Client Guide](/mcpu/guides/client/) — multi-device setup, TCP transport
- [Protocol Spec](/mcpu/reference/protocol/) — JSON-RPC wire format
