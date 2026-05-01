# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                     AI / LLM Host                        │
│  (Claude Desktop, Claude Code, any MCP-compatible host)  │
└────────────────────────┬─────────────────────────────────┘
                         │  MCP Protocol (stdio / HTTP)
                         ▼
┌──────────────────────────────────────────────────────────┐
│               MCP-IoT Client (TypeScript)                │
│                                                          │
│  index.ts        — MCP Server, dynamic tool registration │
│  transport.ts    — Serial / TCP transport abstraction    │
│  device_manager.ts — Multi-device connection + discovery │
│  schema_builder.ts — JSON Schema → Zod converter         │
└───────┬───────────────────────┬────────────────────────--┘
        │ Serial (UART)         │ TCP socket
        ▼                       ▼
┌───────────────┐     ┌─────────────────┐
│ ESP32 #1      │     │ ESP32 #2 (WiFi) │
│ MCP-U lib     │     │ MCP-U lib       │
│ GPIO 2, 5, 34 │     │ GPIO 2, 13, 36  │
└───────────────┘     └─────────────────┘
```

---

## Component Responsibilities

### Firmware (`MCP-U` library)

- Listens on any Arduino `Stream` for newline-delimited JSON-RPC requests
- Maintains a pin registry (type, name, description)
- Dispatches to built-in handlers (`gpio_write`, `gpio_read`, `pwm_write`, `adc_read`)
- Dispatches to user-registered custom tools
- Sends `list_tools` discovery response including full JSON Schema for all tools

### `transport.ts`

- `SerialTransport` — wraps `serialport` library, ReadlineParser for `\n` framing
- `TcpTransport` — wraps Node.js `net.Socket`, manual line buffering
- Both share: pending promise map, request ID counter, timeout logic, disconnect event

### `device_manager.ts`

- Instantiates the correct transport per device config
- Calls `get_info` + `list_tools` on connect
- Caches: `info`, `pins[]`, `tools[]` per device
- Routes `call(device_id, method, params)` to correct transport

### `schema_builder.ts`

- Converts firmware `inputSchema` (JSON Schema) to Zod shape
- Maps: `integer → z.number().int()`, `boolean → z.boolean()`, `string → z.string()`, `number → z.number()`
- Handles `required` → optional fields
- Intentionally minimal (flat schemas only)

### `index.ts`

- Loads device config (env var or `devices.json`)
- Boots `DeviceManager`
- Registers static meta-tool `list_devices`
- Loops over all devices × all tools → `server.registerTool()` dynamically
- Registers MCP Resources: `mcu://devices`, `mcu://{device_id}/pins`

---

## Discovery Sequence

```
Client boots
    │
    ├─► DeviceManager.connect_all()
    │       │
    │       ├─► SerialTransport.connect()   (open port)
    │       ├─► wait 600ms                  (MCU boot / DTR reset)
    │       ├─► rpc.call("get_info")        → { device, version, platform }
    │       └─► rpc.call("list_tools")      → { tools[], pins[] }
    │
    ├─► For each device × each tool:
    │       server.registerTool(name, zodSchema, handler)
    │
    └─► server.connect(StdioTransport)      (ready for Claude)
```

---

## Data Flow — Single Tool Call

```
Claude calls "gpio_write" with { pin: 2, value: true }
    │
    ▼
index.ts handler
    │  strips device_id (if multi-device)
    ▼
DeviceManager.call("esp32-01", "gpio_write", { pin: 2, value: true })
    │
    ▼
SerialTransport.call("gpio_write", { pin: 2, value: true }, timeout=5000)
    │  serializes: {"jsonrpc":"2.0","id":42,"method":"gpio_write","params":{"pin":2,"value":true}}\n
    ▼
/dev/ttyUSB0 ──────────────────────────────────────────► ESP32
                                                              │
                                                    McpDevice._dispatch()
                                                    _handle_gpio_write()
                                                    digitalWrite(2, HIGH)
                                                              │
ESP32 ◄──────────── {"jsonrpc":"2.0","id":42,"result":{...}}\n
    │
    ▼
SerialTransport._handle_line() → resolves pending[42]
    │
    ▼
DeviceManager.call() resolves
    │
    ▼
index.ts returns { content: [{ type: "text", text: "..." }] }
    │
    ▼
Claude receives result
```

---

## Why This Design

| Decision | Rationale |
|----------|-----------|
| UART-first transport | Lowest latency, no network stack, works when WiFi is unavailable |
| Arduino `Stream` abstraction | One firmware API works for Serial, WiFiClient, BluetoothSerial |
| JSON-RPC 2.0 | Standard protocol with error codes, ID tracking, tooling support |
| Self-describing firmware | Client never hardcodes tool names — adding firmware tools is automatic |
| Zod schemas from JSON Schema | MCP SDK requires Zod; firmware returns JSON Schema — thin bridge needed |
| `device_id` as Zod literal | Prevents Claude from calling wrong device, no runtime lookup needed |
