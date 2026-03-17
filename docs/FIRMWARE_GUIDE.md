# MCP/U Firmware Guide — McpIot Library

## Installation

### PlatformIO

The library is included in the `firmware/lib/` directory of this project and is auto-detected.

For standalone use, add to `platformio.ini`:
```ini
lib_deps =
  bblanchon/ArduinoJson @ ^7
  ; local or GitHub path to McpIot
```

### Arduino IDE

1. Download this repository as a ZIP
2. In Arduino IDE: **Sketch → Include Library → Add .ZIP Library**
3. Select the downloaded ZIP
4. Include in your sketch: `#include <McpIot.h>`

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

---

## Platform Notes

- **ESP32**: Full support including `analogWriteFrequency()` for PWM
- **ESP8266**: PWM frequency fixed (no `analogWriteFrequency`)
- **AVR (Uno, Mega)**: Supported. WiFi/BT transports not applicable.
- **RP2040 (Pico)**: Compatible (Arduino framework via Earle Philhower core)
