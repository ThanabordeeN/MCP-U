# MCP/U

**The Unified Interface for AI-Ready Microcontrollers**

[![License: LGPL v3](https://img.shields.io/badge/License-LGPL%20v3-blue.svg)](LICENSE)
[![PlatformIO](https://img.shields.io/badge/PlatformIO-compatible-orange)](https://platformio.org)
[![Arduino](https://img.shields.io/badge/Arduino-IDE%20compatible-blue)](https://www.arduino.cc)

> Transform any Arduino-compatible MCU into an AI-controllable device via the Model Context Protocol.

*By [2edge.co](https://2edge.co)*

---

## Vision

**Universal Connectivity** — One MCP client that Plug-and-Play connects to any device running this standard.

**Self-Describing Firmware** — Devices auto-declare their tools and pin registry via JSON Schema. The client needs zero hardcoded tool names.

**Minimalist Integration** — Firmware developers just `add_pin()`, `add_tool()`, `begin()`. No protocol complexity.

**High-Performance Transport** — Serial (UART) as primary transport for lowest latency. WiFi (TCP) and Bluetooth supported via the same API.

---

## How It Works

```
┌─────────────────┐         ┌──────────────────────┐         ┌───────────────┐
│  Claude Desktop │◄──MCP──►│  MCP-IoT Client (TS) │◄─Serial─►  MCU Firmware │
│  (or any LLM)   │  stdio  │  Dynamic tool regist. │  /TCP   │  McpIot lib   │
└─────────────────┘         └──────────────────────┘         └───────────────┘
```

1. Client connects to MCU over Serial or TCP
2. Client calls `list_tools` — MCU responds with its full tool + pin registry (JSON Schema)
3. Client dynamically registers one MCP tool per MCU tool
4. Claude can now call any MCU tool by name

---

## Quick Start

### 1 — Flash Firmware

```bash
cd firmware
pio run -t upload
```

Or open the `firmware/` folder in Arduino IDE and upload `src/main.cpp`.

### 2 — Start MCP Client

```bash
cd client
npm install
npm run build
SERIAL_PORT=/dev/ttyUSB0 npm start
```

### 3 — Add to Claude Desktop

`~/.config/claude/claude_desktop_config.json` (Linux/macOS):
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

Windows (`%APPDATA%\Claude\claude_desktop_config.json`):
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

---

## Firmware API

```cpp
#include <McpIot.h>

McpDevice mcp("my-device", "1.0.0");

void setup() {
  // Register pins
  mcp.add_pin(2,  "led",    MCP_DIGITAL_OUTPUT, "Status LED");
  mcp.add_pin(34, "sensor", MCP_ADC_INPUT,      "Analog Sensor");

  // Register custom tools
  mcp.add_tool("beep", "Play a tone", beep_handler);

  // Start on any Stream
  mcp.begin(Serial, 115200);      // Serial
  // mcp.begin(wifi_client);      // WiFi
  // mcp.begin(bt);               // Bluetooth
}

void loop() {
  mcp.loop();
}
```

### Pin Types

| Constant            | Arduino API       | Description            |
|---------------------|-------------------|------------------------|
| `MCP_DIGITAL_OUTPUT`| `digitalWrite`    | LED, relay, buzzer     |
| `MCP_DIGITAL_INPUT` | `digitalRead`     | Button, reed switch    |
| `MCP_PWM_OUTPUT`    | `analogWrite`     | Motor, servo, dimmer   |
| `MCP_ADC_INPUT`     | `analogRead`      | Sensor, potentiometer  |

### Custom Tool Handler

```cpp
void my_handler(int id, JsonObject params) {
  // Read params
  int value = params["value"].as<int>();

  // Respond with result
  JsonDocument res;
  res["result"]["ok"] = true;
  mcp.send_result(id, res);

  // Or respond with error
  // mcp.send_error(id, -32602, "Invalid parameter");
}
```

---

## Built-in Tools (auto-exposed on every device)

| Tool              | Parameters                              | Description                     |
|-------------------|-----------------------------------------|---------------------------------|
| `list_tools`      | —                                       | Discovery: tools + pin registry |
| `get_info`        | —                                       | Device name, version, platform  |
| `gpio_write`      | `pin`, `value` (bool)                   | Set digital output HIGH/LOW     |
| `gpio_read`       | `pin`                                   | Read digital level              |
| `pwm_write`       | `pin`, `duty` (0–255), `freq` Hz        | PWM output                      |
| `adc_read`        | `pin`                                   | Read ADC value (0–4095)         |
| `i2c_scan`        | — *(requires `begin_i2c()`)*            | Scan bus, return device addresses |
| `i2c_write_reg`   | `address`, `reg`, `value` *(requires `begin_i2c()`)* | Write byte to register |
| `i2c_read_reg`    | `address`, `reg`, `length` *(requires `begin_i2c()`)* | Read N bytes from register |

### Enable I2C

```cpp
mcp.begin_i2c(21, 22);       // SDA=21, SCL=22 (ESP32)
mcp.begin_i2c();             // board-default pins
mcp.begin_i2c(21, 22, 400000); // 400kHz fast mode
mcp.begin(Serial, 115200);
```

---

## Multi-Device Setup

Add multiple entries to `client/devices.json`:

```json
[
  { "id": "robot-arm",   "transport": "serial", "port": "/dev/ttyUSB0", "baud": 115200 },
  { "id": "greenhouse",  "transport": "serial", "port": "/dev/ttyUSB1", "baud": 115200 },
  { "id": "display-esp", "transport": "tcp",    "host": "192.168.1.50", "port_num": 3000 }
]
```

With multiple devices, MCP tools are named `{device_id}__{tool_name}` (e.g. `robot-arm__gpio_write`).

---

## Project Structure

```
├── firmware/               ESP32 firmware (PlatformIO project)
│   ├── src/main.cpp        Example firmware
│   └── lib/McpIot/         McpIot Arduino library
├── client/                 Universal MCP client (TypeScript)
│   └── src/
│       ├── index.ts        Dynamic MCP server
│       ├── transport.ts    Serial + TCP transports
│       ├── device_manager.ts
│       └── schema_builder.ts
├── examples/               Firmware examples
│   ├── basic-led/
│   ├── multi-sensor/
│   ├── custom-tool/
│   ├── bme280-sensor/      Temperature, humidity, pressure
│   ├── ssd1306-display/    OLED display — Claude writes text to screen
│   ├── mpu6050-motion/     Gyroscope & accelerometer angles
│   └── lcd1604-display/    LCD 16x4 I2C — write text per row/col
├── docs/                   Protocol & integration guides
└── LICENSE                 MIT
```

---

## Docs

- [Protocol Specification](docs/PROTOCOL.md)
- [Firmware Guide](docs/FIRMWARE_GUIDE.md)
- [Client Setup Guide](docs/CLIENT_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Compatibility (supported / not supported)](docs/COMPATIBILITY.md)

---

## License

MIT — see [LICENSE](LICENSE)
