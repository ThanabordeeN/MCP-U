# Architecture

## System Overview

```mermaid
graph TD
    A["AI / LLM Host<br/>(Claude Desktop, Claude Code, any MCP-compatible host)"]
    B["MCP-IoT Client (TypeScript)<br/><br/>index.ts — MCP Server, dynamic tools, resources<br/>transport.ts — Serial / TCP / Mock abstraction<br/>device_manager.ts — Multi-device connection + discovery<br/>schema_builder.ts — JSON Schema to Zod converter<br/><br/>Memory Subsystem:<br/>sqlite_memory_store.ts — DB setup & persistence<br/>buffer_drain_poller.ts — Automated buffer pulling<br/>sqlite_readonly_adapter.ts — Safe SQL execution"]
    C["ESP32 #1<br/>MCP-U lib<br/>GPIO 2, 5, 34"]
    D["ESP32 #2 (WiFi)<br/>MCP-U lib<br/>GPIO 2, 13, 36"]
    E[("mcpu-memory.db<br/>(Historical)")]

    A <-->|"MCP Protocol (stdio / HTTP)"| B
    B -->|"Serial (UART)"| C
    B -->|"TCP Socket"| D
    B -->|"Local SQLite DB"| E
```

---

## Component Responsibilities

### Firmware (`MCP-U` library)

- Listens on any Arduino `Stream` for newline-delimited JSON-RPC requests
- Maintains a pin registry (type, name, description, capabilities, sampling rates)
- Dispatches to built-in handlers (`gpio_write`, `gpio_read`, `get_pin_buffer`, etc.)
- Dispatches to user-registered custom tools
- Sends `list_tools` discovery response including full JSON Schema for all tools

### `transport.ts`

- `SerialTransport` — wraps `serialport` library, ReadlineParser for `\n` framing
- `TcpTransport` — wraps Node.js `net.Socket`, manual line buffering
- `MockTransport` — simulates a connected device for testing without physical hardware
- All share: pending promise map, request ID counter, timeout logic, disconnect event

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

### `memory/` (Buffered Pull Memory Subsystem)

- `sqlite_memory_store.ts` — Manages the SQLite database connection, schema, batch inserts, tool calls, and data retention cleanup.
- `buffer_drain_poller.ts` — Identifies pins with `buffer: true` capabilities and dynamically calculates safe polling intervals to drain MCU ring buffers before they overflow.
- `buffer_expander.ts` — Parses bulk buffer arrays from the MCU and infers timestamps for each sample.
- `sqlite_readonly_adapter.ts` + `sql_guard.ts` — Provides a safe, restricted interface allowing the LLM to query historical observations using only `SELECT` or `WITH` SQL commands.

### `index.ts`

- Loads device config (env var or `devices.json`)
- Boots `DeviceManager` and `Memory Subsystem`
- Registers static meta-tools `list_devices`, `sql_readonly_query`, and `memory_status`
- Loops over all devices × all tools → `server.registerTool()` dynamically
- Registers MCP Resources: `mcu://devices`, `mcu://{device_id}/pins`, `mcu://cache/*`

---

## Discovery Sequence

```mermaid
sequenceDiagram
    participant Client
    participant Transport
    participant MCU

    Client->>Transport: DeviceManager.connect_all()
    Transport->>MCU: SerialTransport.connect() (open port)
    Note over Transport,MCU: wait 600ms (MCU boot / DTR reset)
    Transport->>MCU: rpc.call("get_info")
    MCU-->>Transport: { device, version, platform }
    Transport->>MCU: rpc.call("list_tools")
    MCU-->>Transport: { tools[], pins[] }
    Note over Client: For each device x each tool:<br/>server.registerTool(name, zodSchema, handler)
    Note over Client: server.connect(StdioTransport) (ready for Claude)
```

---

## Data Flow — Single Tool Call

```mermaid
sequenceDiagram
    participant Claude
    participant Index as index.ts handler
    participant DM as DeviceManager
    participant Transport as SerialTransport
    participant ESP32

    Claude->>Index: gpio_write({ pin: 2, value: true })
    Note over Index: strips device_id (if multi-device)
    Index->>DM: call("esp32-01", "gpio_write", params)
    DM->>Transport: call("gpio_write", params, timeout=5000)
    Transport->>ESP32: {"jsonrpc":"2.0","id":42,"method":"gpio_write",...}
    Note over ESP32: McpDevice._dispatch()<br/>_handle_gpio_write()<br/>digitalWrite(2, HIGH)
    ESP32-->>Transport: {"jsonrpc":"2.0","id":42,"result":{...}}
    Transport-->>DM: _handle_line() resolves pending[42]
    DM-->>Index: call() resolves
    Index-->>Claude: { content: [{ type: "text", ... }] }
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
