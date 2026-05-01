---
title: Firmware Guide
description: Install the MCP-U library and learn the complete API for making your MCU AI-ready.
---

## Installation

### PlatformIO

The library lives in `firmware/lib/MCP-U/` and is auto-detected by PlatformIO.

For standalone use, add to `platformio.ini`:
```ini
lib_deps =
  bblanchon/ArduinoJson @ ^7
  ThanabordeeN/MCP-U_Arduino @ ^1.1.0
```

### Arduino IDE

1. **Sketch → Include Library → Manage Libraries** → search `MCP-U` → Install
2. Or [Download as ZIP](https://github.com/ThanabordeeN/MCP-U_Arduino/archive/refs/heads/main.zip) → **Sketch → Include Library → Add .ZIP Library**
3. `#include <MCP-U.h>` in your sketch

---

## API Reference

### `McpDevice(name, version)`

Constructor. Declare once at file scope.

```cpp
McpDevice mcp("my-robot", "2.1.0");
```

---

### `add_pin(pin, name, type, description)`

Register a hardware pin. Call before `begin()`.

| Param | Type | Description |
|-------|------|-------------|
| `pin` | `uint8_t` | GPIO pin number |
| `name` | `const char*` | Short identifier (e.g. `"led"`) |
| `type` | `McpPinType` | See pin types below |
| `description` | `const char*` | Human-readable description |

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

| Helper | Enables | Parameters |
|--------|---------|------------|
| `McpBuffered(bufferSize, intervalMs)` | summary + ring buffer | buffer size, sample interval |
| `McpSummaryOnly(intervalMs)` | rolling statistics only | sample interval |
| `McpThreshold(minValue, maxValue, intervalMs)` | summary + threshold events | min, max, sample interval |
| `McpOutputSafe(approvalRequired)` | output safety metadata | approval flag |

---

### `add_tool(name, description, handler)`

Register a custom RPC tool. Call before `begin()`.

```cpp
void my_handler(int id, JsonObject params) {
  int value = params["value"].as<int>();

  JsonDocument res;
  res["result"]["ok"] = true;
  mcp.send_result(id, res);

  // On error:
  // mcp.send_error(id, -32602, "Invalid parameter");
}

mcp.add_tool("my_action", "Does something custom", my_handler);
```

---

### `begin(stream, baud = 0)`

Start the MCP device on any Arduino Stream.

```cpp
mcp.begin(Serial, 115200);     // USB Serial
mcp.begin(Serial2, 9600);      // Hardware Serial 2
mcp.begin(wifi_client);        // WiFiClient (connect first)
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

Standard codes: `-32700` parse error · `-32600` invalid request · `-32601` not found · `-32602` bad params

---

## Pin Types

| Constant | Direction | Available built-in tools |
|----------|-----------|--------------------------|
| `MCP_DIGITAL_OUTPUT` | Output | `gpio_write`, `gpio_read` |
| `MCP_DIGITAL_INPUT` | Input | `gpio_read` |
| `MCP_PWM_OUTPUT` | Output | `pwm_write` |
| `MCP_ADC_INPUT` | Input | `adc_read` |

---

## Sampling Tools

When a pin is registered with `McpBuffered`, `McpSummaryOnly`, or `McpThreshold`,
MCP-U samples it from `loop()` and exposes additional built-in tools.

### `get_pin_summary`

Returns rolling statistics for a sampled pin.

**Params:** `{ "pin": "<name>" }` or `{ "pin": <gpio> }`

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

```json
{
  "pin": "light",
  "count": 20,
  "values": [402, 418, 421, 430]
}
```

If buffering is not available for a pin:

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

```json
{
  "pin": "temperature",
  "events": [
    { "type": "threshold_high", "value": 38.2, "threshold": 35 }
  ]
}
```

:::note
On AVR builds, `list_tools` omits JSON schemas to save heap. The `mcpu-client`
adds fallback schemas for built-in tools so `pin` and `limit` arguments still
reach the MCU.
:::

---

## Limits

Override via build flags in `platformio.ini`:

```ini
build_flags =
  -DMCP_MAX_PINS=32
  -DMCP_MAX_TOOLS=32
  -DMCP_SERIAL_BUFFER=1024
```

| Constant | AVR default | ESP32 default | Description |
|----------|:-----------:|:-------------:|-------------|
| `MCP_MAX_PINS` | 8 | 16 | Max registered pins |
| `MCP_MAX_TOOLS` | 8 | 24 | Max registered tools |
| `MCP_SERIAL_BUFFER` | 256 B | 512 B | Serial read buffer |
| `MCP_MAX_BUFFERED_PINS` | 2 | 8 | Max pins with ring buffers |
| `MCP_MAX_BUFFER_SIZE` | 20 | 300 | Max samples per ring buffer |
| `MCP_DEFAULT_BUFFER_SIZE` | 10 | 120 | Default buffer size |

Defaults are selected automatically based on architecture — no config needed for typical use.

---

## Examples

### Serial (USB)

The simplest transport — plug in a USB cable and go. Works on every Arduino-compatible board.

```cpp
#include <MCP-U.h>

McpDevice mcp("esp32-demo", "1.0.0");

void handle_hello(int id, JsonObject params) {
  JsonDocument res;
  res["result"]["message"] = "Hello from ESP32!";
  mcp.send_result(id, res);
}

void setup() {
  mcp.add_pin(2,  "led",    MCP_DIGITAL_OUTPUT, "Onboard LED");
  mcp.add_pin(5,  "buzzer", MCP_DIGITAL_OUTPUT, "Piezo Buzzer");
  mcp.add_pin(34, "sensor", MCP_ADC_INPUT,      "Analog Sensor");
  mcp.add_tool("hello", "Returns a greeting", handle_hello);
  mcp.begin(Serial, 115200);
}

void loop() { mcp.loop(); }
```

---

### WiFi TCP (ESP32 / ESP8266)

No USB cable required — the MCU acts as a TCP server on your local network. The client connects by IP address and port.

```cpp
#include <WiFi.h>
#include <MCP-U.h>

static const char*    WIFI_SSID     = "YOUR_SSID";
static const char*    WIFI_PASSWORD = "YOUR_PASSWORD";
static const uint16_t TCP_PORT      = 3000;

McpDevice  mcp("esp32-wifi", "1.0.0");
WiFiServer server(TCP_PORT);
WiFiClient client;

void setup() {
  Serial.begin(115200);

  mcp.add_pin(2,  "led",    MCP_DIGITAL_OUTPUT, "Onboard LED");
  mcp.add_pin(5,  "buzzer", MCP_DIGITAL_OUTPUT, "Piezo Buzzer");
  mcp.add_pin(34, "sensor", MCP_ADC_INPUT,      "Analog Sensor");

  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());   // note this IP for the client

  server.begin();
}

void loop() {
  // Accept new client if none is connected
  if (!client || !client.connected()) {
    WiFiClient incoming = server.accept();
    if (incoming) {
      client = incoming;
      mcp.begin(client);   // swap the MCP stream to the TCP connection
    }
  }
  mcp.loop();
}
```

:::tip
Open the Arduino Serial Monitor after flashing — the ESP32 prints its IP address on boot. Use that IP when configuring the client. See the [Client Guide](/mcpu/guides/client/) and [CLI Agents Guide](/mcpu/guides/cli-agents/) for full connection examples.
:::

---

## Working with External Libraries

The recommended pattern for any sensor or peripheral is to wrap it in a custom tool. Your firmware handles all the hardware complexity — Claude sees only clean, named results.

### PWM with Custom Frequency (LEDC)

The built-in `pwm_write` tool uses `analogWrite(pin, duty)` with the default 5 kHz frequency — enough for LED dimming and most use cases.

If you need a **custom frequency** (e.g. motor control, buzzer tone, servo), use the ESP32 LEDC API in a custom tool instead:

```cpp
#include <MCP-U.h>

McpDevice mcp("esp32-demo", "1.0.0");

void handle_buzzer(int id, JsonObject params) {
  int freq = params["freq"] | 1000;   // Hz
  int duty = params["duty"] | 128;    // 0–255

  ledcSetup(0, freq, 8);              // channel 0, 8-bit resolution
  ledcAttachPin(5, 0);                // GPIO 5 → channel 0
  ledcWrite(0, duty);

  JsonDocument res;
  res["result"]["freq"] = freq;
  res["result"]["duty"] = duty;
  mcp.send_result(id, res);
}

void setup() {
  mcp.add_tool("buzzer_tone", "Play a tone on the buzzer (freq Hz, duty 0-255)", handle_buzzer);
  mcp.begin(Serial, 115200);
}
```

:::note
Use `ledcSetup` / `ledcAttachPin` / `ledcWrite` (ESP32 Arduino core pre-3.x) or `ledcAttach` / `ledcWrite` (core 3.x+).
:::

---

### BME280 (Temperature / Humidity / Pressure)

```cpp
#include <MCP-U.h>
#include <Adafruit_BME280.h>

McpDevice mcp("weather-node", "1.0.0");
Adafruit_BME280 bme;

void handle_read_bme280(int id, JsonObject params) {
  JsonDocument res;
  res["result"]["temperature"] = bme.readTemperature();
  res["result"]["humidity"]    = bme.readHumidity();
  res["result"]["pressure"]    = bme.readPressure() / 100.0F;
  mcp.send_result(id, res);
}

void setup() {
  bme.begin(0x76);
  mcp.add_tool("read_bme280", "Read temperature (°C), humidity (%), pressure (hPa)", handle_read_bme280);
  mcp.begin(Serial, 115200);
}
```

### SSD1306 OLED Display

```cpp
#include <MCP-U.h>
#include <Adafruit_SSD1306.h>

McpDevice mcp("display-node", "1.0.0");
Adafruit_SSD1306 display(128, 64, &Wire);

void handle_show_text(int id, JsonObject params) {
  const char* text = params["text"] | "";
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(text);
  display.display();

  JsonDocument res;
  res["result"]["ok"] = true;
  mcp.send_result(id, res);
}

void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  mcp.add_tool("show_text", "Display text on OLED screen", handle_show_text);
  mcp.begin(Serial, 115200);
}
```

### MPU6050 (Gyroscope / Accelerometer)

```cpp
#include <MCP-U.h>
#include <MPU6050_light.h>

McpDevice mcp("motion-node", "1.0.0");
MPU6050 mpu(Wire);

void handle_read_motion(int id, JsonObject params) {
  mpu.update();
  JsonDocument res;
  res["result"]["angle_x"] = mpu.getAngleX();
  res["result"]["angle_y"] = mpu.getAngleY();
  res["result"]["angle_z"] = mpu.getAngleZ();
  mcp.send_result(id, res);
}

void setup() {
  Wire.begin(21, 22);
  mpu.begin();
  mcp.add_tool("read_motion", "Read gyroscope angles (degrees)", handle_read_motion);
  mcp.begin(Serial, 115200);
}
```

### LCD 16x4 (I2C)

```cpp
#include <MCP-U.h>
#include <LiquidCrystal_I2C.h>

McpDevice mcp("lcd-node", "1.0.0");
LiquidCrystal_I2C lcd(0x27, 16, 4);

void handle_show_text(int id, JsonObject params) {
  int row = params["row"] | 0;
  int col = params["col"] | 0;
  lcd.setCursor(col, row);
  lcd.print(params["text"].as<const char*>());

  JsonDocument res;
  res["result"]["ok"] = true;
  mcp.send_result(id, res);
}

void setup() {
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  mcp.add_tool("show_text", "Write text to LCD (params: text, row=0, col=0)", handle_show_text);
  mcp.begin(Serial, 115200);
}
```

:::tip
Any Arduino-compatible library works. Initialize it yourself in `setup()`, then expose it through `add_tool()`. Claude never needs to know the underlying hardware details.
:::

---

## Platform Notes

| Platform | Serial | WiFi TCP | Bluetooth | PWM freq |
|----------|:------:|:--------:|:---------:|:--------:|
| ESP32 | ✅ | ✅ | ✅ BLE Serial | ✅ |
| ESP8266 | ✅ | ✅ | ❌ | ⚠️ fixed |
| AVR (Uno/Mega) | ✅ | ❌ | ❌ | ⚠️ limited pins |
| RP2040 (Pico) | ✅ | ⚠️ Pico W | ❌ | ✅ |
