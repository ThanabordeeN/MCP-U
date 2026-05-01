# MCP/U Firmware Guide — MCP-U Library

## Installation

### PlatformIO

The library is included in the `firmware/lib/` directory of this project and is auto-detected.

For standalone use, add to `platformio.ini`:
```ini
lib_deps =
  bblanchon/ArduinoJson @ ^7
  ; local or GitHub path to MCP-U
```

### Arduino IDE

1. Download this repository as a ZIP
2. In Arduino IDE: **Sketch → Include Library → Add .ZIP Library**
3. Select the downloaded ZIP
4. Include in your sketch: `#include <MCP-U.h>`

---

## API Reference

### `McpDevice(name, version)`

Constructor. Call once at the top of your sketch.

```cpp
McpDevice mcp("my-robot", "2.1.0");
```

---

### `add_pin(pin, name, type, description)`

Register a hardware pin. Must be called before `begin()`.

| Param         | Type        | Description                          |
|---------------|-------------|--------------------------------------|
| `pin`         | `uint8_t`   | GPIO pin number                      |
| `name`        | `const char*` | Short identifier (e.g. `"led"`)    |
| `type`        | `McpPinType`| See pin types table below            |
| `description` | `const char*` | Human-readable description         |

```cpp
mcp.add_pin(2,  "led",    MCP_DIGITAL_OUTPUT, "Status LED");
mcp.add_pin(34, "sensor", MCP_ADC_INPUT,      "Light Sensor");
```

---

### `add_pin(..., options)`

Register a pin with sampling, rolling statistics, buffer, or threshold-event behavior.
Options are only meaningful for input pins (`MCP_DIGITAL_INPUT`, `MCP_ADC_INPUT`).
Output pins automatically ignore sampling options.

```cpp
mcp.add_pin(
  34,
  "light",
  MCP_ADC_INPUT,
  "Light sensor",
  McpBuffered(20, 500)  // keep 20 samples, sample every 500 ms
);
```

Helper constructors:

| Helper | Enables | Parameters |
|--------|---------|------------|
| `McpBuffered(bufferSize, intervalMs)` | summary + ring buffer | buffer size, sample interval |
| `McpSummaryOnly(intervalMs)` | rolling statistics only | sample interval |
| `McpThreshold(minValue, maxValue, intervalMs)` | summary + threshold events | min, max, sample interval |
| `McpOutputSafe(approvalRequired)` | output safety metadata | approval flag |

---

### `add_tool(name, description, handler)`

Register a custom RPC tool. Must be called before `begin()`.

```cpp
void my_handler(int id, JsonObject params) {
  // ... your logic ...
  JsonDocument res;
  res["result"]["ok"] = true;
  mcp.send_result(id, res);
}

mcp.add_tool("my_action", "Does something custom", my_handler);
```

---

### `begin(stream, baud = 0)`

Start the MCP device on any Arduino Stream.

```cpp
mcp.begin(Serial, 115200);     // USB Serial
mcp.begin(Serial2, 9600);      // Hardware Serial 2
mcp.begin(wifi_client);        // WiFiClient (call wifi_client.connect() first)
mcp.begin(bt);                 // BluetoothSerial
```

---

### `loop()`

Call from Arduino `loop()`. Reads and dispatches one RPC request per call.

```cpp
void loop() {
  mcp.loop();
}
```

---

### `send_result(id, doc)`

Send a success response. Set `doc["result"]` before calling.

```cpp
JsonDocument res;
res["result"]["temperature"] = 25.4;
mcp.send_result(id, res);
```

---

### `send_error(id, code, message)`

Send an error response.

```cpp
mcp.send_error(id, -32602, "Invalid pin number");
```

Standard codes: `-32700` parse error, `-32600` invalid request, `-32601` not found, `-32602` bad params.

---

## Pin Types

| Constant            | Direction | Built-in tools available         |
|---------------------|-----------|----------------------------------|
| `MCP_DIGITAL_OUTPUT`| Output    | `gpio_write`, `gpio_read`        |
| `MCP_DIGITAL_INPUT` | Input     | `gpio_read`                      |
| `MCP_PWM_OUTPUT`    | Output    | `pwm_write`                      |
| `MCP_ADC_INPUT`     | Input     | `adc_read`                       |

---

## Sampling Tools

When a pin is registered with `McpBuffered`, `McpSummaryOnly`, or `McpThreshold`,
MCP-U samples it from `loop()` and exposes additional built-in tools.

### `get_pin_summary`

Returns rolling statistics for a sampled pin.

**Params:** `{ "pin": "<name>" }` or `{ "pin": <gpio> }`

**Response:**
```json
{
  "pin": 34,
  "name": "light",
  "latest": 812,
  "min": 120,
  "max": 980,
  "avg": 531.4,
  "samples": 42
}
```

### `get_pin_buffer`

Returns recent samples from a ring buffer. `limit` is optional.

**Params:** `{ "pin": "<name>", "limit": 10 }`

**Response:**
```json
{
  "pin": "light",
  "count": 20,
  "values": [402, 418, 421, 430]
}
```

If buffering is not available for a pin, the tool returns:

```json
{
  "pin": "light",
  "buffer_available": false,
  "reason": "Buffer disabled on this platform or pin. Use get_pin_summary instead."
}
```

### `get_pin_events`

Reports the current threshold state for pins registered with `McpThreshold`.

**Params:** `{ "pin": "<name>" }`

**Response:**
```json
{
  "pin": "temperature",
  "events": [
    { "type": "threshold_high", "value": 38.2, "threshold": 35 }
  ]
}
```

On AVR builds, `list_tools` omits JSON schemas to save heap. The `mcpu-client`
adds fallback schemas for built-in tools so `pin` and `limit` arguments still
reach the MCU.

---

## Limits

Override via build flags:

```ini
build_flags =
  -DMCP_MAX_PINS=32
  -DMCP_MAX_TOOLS=32
```

| Constant           | Default | Description               |
|--------------------|---------|---------------------------|
| `MCP_MAX_PINS`     | 16      | Max registered pins       |
| `MCP_MAX_TOOLS`    | 24      | Max registered tools      |
| `MCP_SERIAL_BUFFER`| 512     | Serial read buffer size   |
| `MCP_MAX_BUFFERED_PINS` | 8  | Max pins with ring buffers on ESP32 |
| `MCP_MAX_BUFFER_SIZE` | 300  | Max samples per ring buffer on ESP32 |
| `MCP_DEFAULT_BUFFER_SIZE` | 120 | Default buffer size on ESP32 |

---

## Platform Notes

- **ESP32**: Full support including `analogWriteFrequency()` for PWM
- **ESP8266**: PWM frequency fixed (no `analogWriteFrequency`)
- **AVR (Uno, Mega)**: Supported. WiFi/BT transports not applicable.
- **RP2040 (Pico)**: Compatible (Arduino framework via Earle Philhower core)
