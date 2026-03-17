/**
 * MCP/U — ESP32 Firmware Example
 * By 2edge.co — LGPL-3.0
 *
 * Demonstrates the McpIot library with:
 *   - LED on GPIO 2          (digital output)
 *   - Buzzer on GPIO 5       (digital output)
 *   - Analog sensor GPIO 34  (ADC input)
 *   - Custom "hello" tool
 *   - I2C on SDA=21, SCL=22  (i2c_scan, i2c_read_reg, i2c_write_reg)
 *
 * Common I2C addresses:
 *   0x3C — SSD1306 OLED display
 *   0x76 — BME280 temperature/humidity/pressure
 *   0x68 — MPU6050 gyroscope/accelerometer
 *
 * Transport: Serial (USB-UART) at 115200 baud
 */

#include <McpIot.h>

McpDevice mcp("esp32-demo", "1.0.0");

// ---------------------------------------------------------------------------
// Custom tool: hello
// ---------------------------------------------------------------------------

void handle_hello(int id, JsonObject params) {
  JsonDocument res;
  res["result"]["message"] = "Hello from ESP32!";
  mcp.send_result(id, res);
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------

void setup() {
  // GPIO pins
  mcp.add_pin(2,  "led",    MCP_DIGITAL_OUTPUT, "Onboard LED (GPIO 2)");
  mcp.add_pin(5,  "buzzer", MCP_DIGITAL_OUTPUT, "Piezo Buzzer (GPIO 5)");
  mcp.add_pin(34, "sensor", MCP_ADC_INPUT,      "Analog Sensor Input (GPIO 34)");

  // Custom tools
  mcp.add_tool("hello", "Returns a greeting from the device", handle_hello);

  // I2C — enables i2c_scan, i2c_read_reg, i2c_write_reg built-in tools
  // SDA=21, SCL=22 (ESP32 default). Call begin_i2c() before begin().
  mcp.begin_i2c(21, 22);

  mcp.begin(Serial, 115200);
}

void loop() {
  mcp.loop();
}

// ---------------------------------------------------------------------------
// I2C usage examples (call via MCP tools, not in code):
//
// Scan bus:
//   i2c_scan  →  { "devices": [60, 118], "count": 2 }
//
// Read BME280 chip ID (reg 0xD0, expect 0x60):
//   i2c_read_reg { "address": 118, "reg": 208, "length": 1 }
//   →  { "data": [96], "hex": "60" }
//
// Write SSD1306 display off command (reg 0x00, value 0xAE):
//   i2c_write_reg { "address": 60, "reg": 0, "value": 174 }
//   →  { "ok": true }
// ---------------------------------------------------------------------------
