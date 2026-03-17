# MCP/U Client Setup Guide

## Requirements

- Node.js 18+
- TypeScript 5+ (dev dependency, included)

---

## Installation

```bash
cd client
npm install
npm run build
```

---

## Configuration

### Option 1 — `devices.json`

Edit `client/devices.json`:

```json
[
  {
    "id": "esp32-01",
    "transport": "serial",
    "port": "/dev/ttyUSB0",
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

### Option 2 — `DEVICES` environment variable

Format: `id:port:baud` (serial) or `id:host:port:tcp` (TCP), comma-separated.

```bash
# Single serial device
DEVICES=esp32-01:/dev/ttyUSB0:115200 npm start

# Multiple devices
DEVICES=robot:/dev/ttyUSB0:115200,sensor:192.168.1.50:3000:tcp npm start

# Windows
set DEVICES=esp32-01:COM3:115200 && npm start
```

---

## Running

```bash
# Production (compiled JS)
npm start

# Development (watch mode, no compile step)
npm run dev
```

---

## Claude Desktop Integration

### Linux / macOS

`~/.config/claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcu": {
      "command": "node",
      "args": ["/home/user/ESP32-MCP-TESTING/client/dist/index.js"],
      "env": {
        "DEVICES": "esp32-01:/dev/ttyUSB0:115200"
      }
    }
  }
}
```

### Windows (CMD)

`%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mcu": {
      "command": "cmd",
      "args": [
        "/c",
        "node",
        "C:\\Users\\YourName\\ESP32-MCP-TESTING\\client\\dist\\index.js"
      ],
      "env": {
        "DEVICES": "esp32-01:COM3:115200"
      }
    }
  }
}
```

---

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Open the browser URL shown. You can:
- Browse discovered tools
- Call `list_devices` to see connected MCUs
- Call `gpio_write` / `gpio_read` interactively

---

## Finding Your Serial Port

**Linux:**
```bash
ls /dev/ttyUSB* /dev/ttyACM*
# Common: /dev/ttyUSB0
```

**macOS:**
```bash
ls /dev/tty.usbserial-* /dev/tty.usbmodem*
```

**Windows:**
- Device Manager → Ports (COM & LPT)
- Or in PowerShell: `[System.IO.Ports.SerialPort]::GetPortNames()`

**Permission error on Linux:**
```bash
sudo usermod -aG dialout $USER
# Log out and back in
```

---

## Dynamic Tool Discovery

The client has **zero hardcoded tool names**. On startup:

1. Connects to all configured devices
2. Calls `get_info` + `list_tools` on each
3. Builds Zod schemas from the firmware's JSON Schema response
4. Registers one MCP tool per firmware tool

Adding a new tool to firmware = the MCP tool appears automatically on next client restart.

### Tool Naming

| Scenario      | Tool name format              | Example                  |
|---------------|-------------------------------|--------------------------|
| Single device | `{tool_name}`                 | `gpio_write`             |
| Multi device  | `{device_id}__{tool_name}`    | `robot__gpio_write`      |
