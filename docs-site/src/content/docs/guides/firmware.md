---
title: Firmware Guide
description: Install the McpIot library and learn the complete API for making your MCU AI-ready.
---

## Installation

### PlatformIO

The library lives in `firmware/lib/McpIot/` and is auto-detected by PlatformIO.

For standalone use, add to `platformio.ini`:
```ini
lib_deps =
  bblanchon/ArduinoJson @ ^7
  ; path to McpIot (local or GitHub)
```

### Arduino IDE

1. Download this repo as a ZIP
2. **Sketch → Include Library → Add .ZIP Library**
3. Select the ZIP
4. `#include <McpIot.h>` in your sketch

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

## Limits

Override via build flags in `platformio.ini`:

```ini
build_flags =
  -DMCP_MAX_PINS=32
  -DMCP_MAX_TOOLS=32
  -DMCP_SERIAL_BUFFER=1024
```

| Constant | Default | Description |
|----------|---------|-------------|
| `MCP_MAX_PINS` | 16 | Max registered pins |
| `MCP_MAX_TOOLS` | 24 | Max registered tools |
| `MCP_SERIAL_BUFFER` | 512 | Serial read buffer (bytes) |

---

## Full Example

```cpp
#include <McpIot.h>

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

## Working with External Libraries

The recommended pattern for any sensor or peripheral is to wrap it in a custom tool. Your firmware handles all the hardware complexity — Claude sees only clean, named results.

### PWM with Custom Frequency (LEDC)

The built-in `pwm_write` tool uses `analogWrite(pin, duty)` with the default 5 kHz frequency — enough for LED dimming and most use cases.

If you need a **custom frequency** (e.g. motor control, buzzer tone, servo), use the ESP32 LEDC API in a custom tool instead:

```cpp
#include <McpIot.h>

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
#include <McpIot.h>
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
#include <McpIot.h>
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
#include <McpIot.h>
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
#include <McpIot.h>
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
