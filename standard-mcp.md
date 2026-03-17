# Unified MCP-IoT Interface Standard — Implementation Plan

## Context

This project transforms microcontrollers into AI-Ready Devices via JSON-RPC 2.0 over Serial. Currently, the firmware is a monolithic `main.cpp` with hardcoded tools, and the MCP client has hardcoded `registerTool` calls in JavaScript. The goal is to refactor into:

1. **A reusable Arduino library** (`McpIot`) — firmware devs just `add_pin()` / `add_tool()` / `begin()`
2. **A fully dynamic TypeScript MCP client** — discovers tools from firmware at runtime, zero hardcoded tool names

## File Structure (After Refactor)

```
ESP32-MCP-TESTING/
  lib/
    McpIot/
      McpIot.h              ← Public API header (~120 lines)
      McpIot.cpp            ← Implementation (~280 lines)
      library.json          ← PlatformIO metadata
  src/
    main.cpp                ← Minimal example using library (~40 lines)
  mcp-client/
    src/
      serial_rpc.ts         ← Serial JSON-RPC transport + timeout
      device_manager.ts     ← Multi-device connection + discovery
      schema_builder.ts     ← JSON Schema → Zod converter
      index.ts              ← Dynamic MCP server (zero hardcoded tools)
    devices.json
    package.json            ← Updated: TypeScript deps, build script
    tsconfig.json           ← New
  platformio.ini
```

---

## Phase 1: Arduino Library (`lib/McpIot/`)

### `lib/McpIot/McpIot.h` (new)

Public API — unified transport via Arduino `Stream` (Serial, WiFi, BLE all inherit from `Stream`):

```cpp
#define MCP_MAX_PINS  16
#define MCP_MAX_TOOLS 16

enum McpPinType { MCP_DIGITAL_OUTPUT, MCP_DIGITAL_INPUT, MCP_PWM_OUTPUT, MCP_ADC_INPUT };

typedef void (*McpToolHandler)(int id, JsonObject params);

class McpDevice {
public:
    McpDevice(const char* name, const char* version);
    void add_pin(uint8_t pin, const char* name, McpPinType type, const char* desc);
    void add_tool(const char* name, const char* desc, McpToolHandler handler);
    void begin(Stream& stream);          // Any Arduino Stream: Serial, WiFiClient, BluetoothSerial
    void loop();
    void send_error(int id, int code, const char* message);
    void send_result(int id, JsonDocument& doc);
};
```

Transport is pluggable via `Stream&`:
```cpp
// Serial
Serial.begin(115200);
mcp.begin(Serial);

// WiFi
WiFiClient client = server.available();
mcp.begin(client);

// Bluetooth (ESP32)
BluetoothSerial bt;
bt.begin("ESP32-MCP");
mcp.begin(bt);
```

All transports share the same JSON-RPC protocol, tool registry, and discovery — zero code changes to tools/pins.

### `lib/McpIot/McpIot.cpp` (new)

Port existing handler logic from current `src/main.cpp`:
- Built-in tools registered in `begin()`: `get_info`, `list_tools`, `gpio_write`, `gpio_read`, `pwm_write`, `adc_read`
- Dispatcher iterates `_tools[]` array with `strcmp` — replaces if-else chain
- `list_tools` enhanced to return full `inputSchema.properties` (not just `required`), e.g.:
  ```json
  { "pin": { "type": "integer", "description": "GPIO pin number" } }
  ```
- Static `_instance` pointer so C-style callbacks can access instance data
- Platform guards: `#ifdef ESP32` for `analogWriteFrequency`

### `lib/McpIot/library.json` (new — PlatformIO)

PlatformIO manifest: name, version, platforms `[espressif32, espressif8266, atmelavr]`, dep on ArduinoJson ^7.

### `lib/McpIot/library.properties` (new — Arduino IDE)

Arduino IDE library manifest (required for Arduino Library Manager):
```
name=McpIot
version=1.0.0
author=MCP-IoT Contributors
maintainer=MCP-IoT Contributors
sentence=MCP-IoT Standard: JSON-RPC 2.0 over Serial for AI-ready microcontrollers
paragraph=Turn any Arduino-compatible MCU into an AI-controllable device via Model Context Protocol
category=Communication
url=https://github.com/your-repo/mcp-iot
architectures=esp32,esp8266,avr
depends=ArduinoJson
```

### `lib/McpIot/keywords.txt` (new — Arduino IDE syntax highlighting)

```
McpDevice	KEYWORD1
add_pin	KEYWORD2
add_tool	KEYWORD2
begin	KEYWORD2
loop	KEYWORD2
send_error	KEYWORD2
send_result	KEYWORD2
MCP_DIGITAL_OUTPUT	LITERAL1
MCP_DIGITAL_INPUT	LITERAL1
MCP_PWM_OUTPUT	LITERAL1
MCP_ADC_INPUT	LITERAL1
```

### Installation Methods

1. **Arduino IDE**: Download ZIP from GitHub → Sketch → Include Library → Add .ZIP Library
   - Or via Library Manager once published (future)
2. **PlatformIO**: Add `lib_deps = McpIot` in `platformio.ini` (local lib in `lib/` auto-detected)
   - Or future: `lib_deps = github-user/McpIot` from PlatformIO registry
3. **Manual**: Clone `lib/McpIot/` into Arduino `libraries/` folder or PlatformIO `lib/`

### `src/main.cpp` (rewrite → ~40 lines)

Minimal example:
```cpp
#include <McpIot.h>
McpDevice mcp("esp32-demo", "1.0.0");

void setup() {
    mcp.add_pin(2, "led", MCP_DIGITAL_OUTPUT, "Onboard LED");
    mcp.add_pin(5, "buzzer", MCP_DIGITAL_OUTPUT, "Piezo Buzzer");
    mcp.add_pin(34, "sensor", MCP_ADC_INPUT, "Analog Sensor");
    mcp.begin(Serial, 115200);
}

void loop() { mcp.loop(); }
```

---

## Phase 2: MCP Client — TypeScript Rewrite

### `package.json` (update)

- Add devDeps: `typescript`, `@types/node`, `tsx`
- Update scripts: `"build": "tsc"`, `"start": "node dist/index.js"`, `"dev": "tsx src/index.ts"`
- Update `"main": "dist/index.js"`, `"bin": { "mcu-mcp": "dist/index.js" }`

### `tsconfig.json` (new)

Target `ES2022`, module `NodeNext`, `outDir: "dist"`, strict mode.

### `src/transport.ts` (new — replaces serial_rpc.js)

Abstract transport interface + two implementations:

```ts
interface McpTransport {
  connect(): Promise<void>;
  call(method: string, params?: object, timeout_ms?: number): Promise<any>;
  is_connected: boolean;
  on_disconnect(cb: () => void): void;
  close(): void;
}

class SerialTransport implements McpTransport { ... }  // USB/UART via serialport
class TcpTransport implements McpTransport { ... }     // WiFi devices via net.Socket
```

Both share the same JSON-RPC framing (newline-delimited JSON, ID matching).
- **Timeout handling**: `call()` wraps pending promise with `setTimeout` (default 5000ms)
- **`is_connected` getter**
- **Disconnect callback**: forwards `close` event

`devices.json` updated to specify transport type:
```json
[
  { "id": "esp32-serial", "transport": "serial", "port": "/dev/ttyUSB0", "baud": 115200 },
  { "id": "esp32-wifi",   "transport": "tcp",    "host": "192.168.1.50", "port": 3000 }
]
```

### `src/schema_builder.ts` (new, ~50 lines)

Converts firmware JSON Schema → Zod shape:

```ts
const TYPE_MAP: Record<string, (prop: SchemaProp) => z.ZodTypeAny> = {
  integer: (p) => z.number().int().describe(p.description ?? ""),
  number:  (p) => z.number().describe(p.description ?? ""),
  boolean: (p) => z.boolean().describe(p.description ?? ""),
  string:  (p) => z.string().describe(p.description ?? ""),
};
```

Flat schemas only (matches MCU constraint). Handles `required` field.

### `src/device_manager.ts` (rewrite from .js)

Port existing logic + add:
- Store `tools[]` from discovery (not just `info` and `pins`)
- `list()` returns `{ id, info, pins, tools }`
- Call both `get_info` and `list_tools` during `_connect_one()`
- TypeScript interfaces: `DeviceConfig`, `DeviceEntry`, `PinInfo`, `ToolInfo`

### `src/index.ts` (rewrite — core change)

**Dynamic tool registration** — zero hardcoded tool names:

1. Load device configs (env or `devices.json`) — same as current
2. Connect all devices via `DeviceManager`
3. Register `list_devices` meta-tool (only hardcoded tool)
4. **For each device → for each tool from discovery:**
   ```ts
   const tool_name = devices.length === 1
     ? tool.name                          // no prefix if single device
     : `${device.id}__${tool.name}`;      // prefix if multi-device

   const zod_schema = {
     device_id: z.literal(device.id),
     ...json_schema_to_zod(tool.inputSchema),
   };

   server.registerTool(tool_name, { description, inputSchema: zod_schema }, handler);
   ```
5. Register dynamic resources: `mcu://devices`, `mcu://{device_id}/pins`

Tool naming strategy:
- **Single device**: `gpio_write`, `gpio_read`, etc. — clean, no prefix
- **Multi device**: `esp32-01__gpio_write`, `esp32-02__gpio_write` — double underscore separator

---

## Phase 3: Protocol Hardening

- **JSON-RPC 2.0 compliance**: Support string IDs (`JsonVariant` not `int`)
- **Notification support**: Requests without `id` get no response
- **Validate `jsonrpc` field** in firmware

---

## Phase 4: Clean Directory Structure & Documentation

### Project Root Files

```
ESP32-MCP-TESTING/
├── LICENSE                          ← MIT License
├── README.md                        ← Main project README (comprehensive)
├── docs/
│   ├── PROTOCOL.md                  ← JSON-RPC 2.0 protocol spec
│   ├── FIRMWARE_GUIDE.md            ← How to use McpIot library
│   ├── CLIENT_GUIDE.md              ← How to set up MCP client
│   └── ARCHITECTURE.md              ← System architecture diagram + flow
├── firmware/
│   ├── platformio.ini
│   ├── src/
│   │   └── main.cpp                 ← Example firmware
│   ├── lib/
│   │   └── McpIot/
│   │       ├── McpIot.h              ← Public API
│   │       ├── McpIot.cpp            ← Implementation
│   │       ├── library.json          ← PlatformIO manifest
│   │       ├── library.properties    ← Arduino IDE manifest
│   │       └── keywords.txt          ← Arduino IDE syntax highlighting
│   ├── include/
│   └── test/
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── devices.json
│   └── src/
│       ├── index.ts              ← Dynamic MCP server
│       ├── transport.ts          ← Transport interface + Serial/TCP impls
│       ├── device_manager.ts     ← Multi-device connection + discovery
│       └── schema_builder.ts     ← JSON Schema → Zod converter
├── examples/
│   ├── basic-led/
│   │   └── main.cpp                 ← Minimal LED-only example
│   ├── multi-sensor/
│   │   └── main.cpp                 ← DHT + analog + digital example
│   └── custom-tool/
│       └── main.cpp                 ← Custom tool registration example
└── .gitignore
```

Key changes from current structure:
- Rename `mcp-client/` → `client/` (cleaner)
- Move PlatformIO project into `firmware/` subdirectory
- Add `docs/` for comprehensive documentation
- Add `examples/` with progressively complex firmware examples
- Add `LICENSE` (MIT) at root
- Add `.gitignore` updated for both firmware + TS client

### `LICENSE` (new)

MIT License, copyright 2026, standard MIT text.

### `README.md` (new, comprehensive)

Sections:
1. **Header**: Project name, badges (License MIT, PlatformIO, Node.js), one-line description
2. **Vision**: The "Unified MCP-IoT Interface Standard" statement (from user's vision)
3. **How It Works**: Architecture diagram showing Claude ↔ MCP Client ↔ Serial ↔ MCU
4. **Quick Start**:
   - Flash firmware: `cd firmware && pio run -t upload`
   - Start client: `cd client && npm install && npm run build && SERIAL_PORT=/dev/ttyUSB0 npm start`
   - Add to Claude Desktop: JSON config snippet
5. **Firmware API**: `McpDevice` API reference with code examples
6. **Adding Custom Tools**: Step-by-step code example
7. **Pin Types**: Table of supported pin types
8. **Protocol Reference**: Link to `docs/PROTOCOL.md`
9. **Multi-Device Setup**: `devices.json` config example
10. **Examples**: Links to `examples/` directory
11. **License**: MIT

### `docs/PROTOCOL.md` (new)

Full JSON-RPC 2.0 protocol specification:
- Transport: Serial UART, newline-delimited JSON
- Standard methods: `get_info`, `list_tools`, `gpio_write`, `gpio_read`, `pwm_write`, `adc_read`
- Discovery response schema (full JSON example)
- Error codes table (-32700, -32600, -32601, -32602)
- Pin types enum
- Request/response examples for every method

### `docs/FIRMWARE_GUIDE.md` (new)

- Installation via PlatformIO
- `McpDevice` API reference (add_pin, add_tool, begin, loop, send_error, send_result)
- Pin registry configuration
- Writing custom tool handlers
- Platform compatibility notes (ESP32, ESP8266, AVR)

### `docs/CLIENT_GUIDE.md` (new)

- Installation & build (npm install, npm run build)
- Configuration: `devices.json` format, `DEVICES` env var
- Claude Desktop integration (full config example for Linux, macOS, Windows CMD)
- MCP Inspector testing
- Dynamic tool discovery explanation
- Multi-device setup

### `docs/ARCHITECTURE.md` (new)

- System architecture diagram (ASCII art)
- Data flow: Claude → MCP stdio → client → serial JSON-RPC → firmware → GPIO
- Component responsibilities
- Discovery sequence diagram
- Why this design (UART speed, JSON-RPC standard, MCP compatibility)

### `.gitignore` (update)

```
# Firmware
firmware/.pio/
firmware/lib/McpIot/.vscode/

# Client
client/node_modules/
client/dist/

# IDE
.vscode/
*.swp
.DS_Store
```

---

## Verification

1. **Firmware compiles**: `cd firmware && pio run`
2. **TypeScript compiles**: `cd client && npm install && npm run build`
3. **Discovery test**: Connect ESP32, run `echo '{"jsonrpc":"2.0","id":1,"method":"list_tools"}' > /dev/ttyUSB0` and verify tools + pins + full inputSchema properties
4. **MCP inspector**: Run `npx @modelcontextprotocol/inspector node dist/index.js` — verify tools are dynamically listed
5. **Add custom tool on firmware** → restart → MCP client picks it up automatically without code changes
6. **Docs render**: All markdown files render correctly on GitHub
