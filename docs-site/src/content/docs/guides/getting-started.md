---
title: Quick Start
description: Flash firmware, start the client, and connect Claude to your MCU in minutes.
---

## Prerequisites

- ESP32 board (or any Arduino-compatible MCU)
- [PlatformIO](https://platformio.org) or Arduino IDE
- Node.js 18+
- Claude Desktop (or any MCP-compatible host)

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
- Custom tool: `hello`

---

## Step 2 — Start the MCP Client

```bash
cd client
npm install
npm run build
DEVICES=esp32-01:/dev/ttyUSB0:115200 npm start
```

**Windows:**
```cmd
set DEVICES=esp32-01:COM3:115200 && npm start
```

:::tip[Find your port]
**Linux:** `ls /dev/ttyUSB* /dev/ttyACM*`
**macOS:** `ls /dev/tty.usbserial-*`
**Windows:** Device Manager → Ports (COM & LPT)
:::

---

## Step 3 — Add to Claude Desktop

**Linux / macOS** — `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcu": {
      "command": "node",
      "args": ["/absolute/path/to/client/dist/index.js"],
      "env": {
        "DEVICES": "esp32-01:/dev/ttyUSB0:115200"
      }
    }
  }
}
```

**Windows** — `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcu": {
      "command": "node",
      "args": ["C:\\path\\to\\client\\dist\\index.js"],
      "env": {
        "DEVICES": "esp32-01:COM3:115200"
      }
    }
  }
}
```

Restart Claude Desktop. You should now be able to ask Claude to control your MCU.

---

## Verify with MCP Inspector

Before connecting Claude, test with the MCP Inspector:

```bash
cd client
npx @modelcontextprotocol/inspector node dist/index.js
```

Open the browser URL shown and try calling `list_devices` or `gpio_write`.

---

## Next Steps

- [Firmware Guide](/mcpu/guides/firmware/) — full `McpIot` API reference
- [Client Guide](/mcpu/guides/client/) — multi-device setup, TCP transport
- [Protocol Spec](/mcpu/reference/protocol/) — JSON-RPC wire format
