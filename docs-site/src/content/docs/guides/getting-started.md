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

## Step 1 — Choose a Transport

MCP/U supports two transports. Pick one based on your setup:

| | Serial (USB) | WiFi TCP |
|-|:---:|:---:|
| Cable required | Yes | No |
| Board support | All | ESP32 / ESP8266 |
| Setup complexity | Minimal | Needs SSID + password |
| Use case | Development | Deployment / wireless |

---

## Step 2 — Flash Firmware

Clone the repo and flash the matching example:

### Serial

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

### WiFi TCP

Edit the credentials at the top of the sketch before uploading:

```cpp
static const char*    WIFI_SSID     = "YOUR_SSID";
static const char*    WIFI_PASSWORD = "YOUR_PASSWORD";
static const uint16_t TCP_PORT      = 3000;
```

After flashing, open the Serial Monitor — the ESP32 prints its IP address on boot:

```
Connecting to WiFi....
IP: 192.168.1.42
TCP server listening on port 3000
```

Note that IP — you'll need it in Step 4.

---

## Step 3 — Find your serial port

*(Skip this step if you're using WiFi TCP.)*

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

## Step 4 — Add to your AI agent

The MCP/U client is published on npm — no local clone needed.

### Claude Desktop

**Serial — Linux / macOS** (`~/.config/claude/claude_desktop_config.json`):

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

**Serial — Windows** (`%APPDATA%\Claude\claude_desktop_config.json`):

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

**WiFi TCP** (replace IP with the one printed by your ESP32):

```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "DEVICES": "mydevice:192.168.1.42:3000:tcp"
      }
    }
  }
}
```

Multiple devices (mix Serial and TCP freely):
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "DEVICES": "robot:/dev/ttyUSB0:115200,sensor:192.168.1.42:3000:tcp"
      }
    }
  }
}
```

---

### Claude Code (CLI)

```bash
# Serial
claude mcp add mcpu -e SERIAL_PORT=/dev/ttyACM0 -- npx mcpu-client

# WiFi TCP
claude mcp add mcpu -e DEVICES=mydevice:192.168.1.42:3000:tcp -- npx mcpu-client
```

---

### Gemini CLI

Edit `~/.gemini/settings.json`:

**Serial:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": { "SERIAL_PORT": "/dev/ttyACM0" }
    }
  }
}
```

**WiFi TCP:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": { "DEVICES": "mydevice:192.168.1.42:3000:tcp" }
    }
  }
}
```

---

### OpenCode

`opencode.json` — Serial:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcpu": {
      "type": "local",
      "command": ["npx", "mcpu-client"],
      "enabled": true,
      "environment": { "SERIAL_PORT": "/dev/ttyACM0" }
    }
  }
}
```

WiFi TCP — replace `SERIAL_PORT` with `DEVICES`:

```json
"environment": { "DEVICES": "mydevice:192.168.1.42:3000:tcp" }
```

Restart your agent. Claude can now control your MCU.

---

## Verify with MCP Inspector

```bash
SERIAL_PORT=/dev/ttyACM0 npx @modelcontextprotocol/inspector npx mcpu-client
```

Open the browser URL shown and try calling `list_devices` or `gpio_write`.

---

## Next Steps

- [Firmware Guide](/mcpu/guides/firmware/) — full `MCP-U` API reference
- [Client Guide](/mcpu/guides/client/) — multi-device setup, TCP transport
- [Protocol Spec](/mcpu/reference/protocol/) — JSON-RPC wire format
