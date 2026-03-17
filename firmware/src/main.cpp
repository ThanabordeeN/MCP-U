/**
 * MCP/U — ESP32 Firmware Example
 * By 2edge.co — LGPL-3.0
 *
 * Hardware:
 *   - Built-in LED  GPIO 2   (digital output)
 *   - Buzzer        GPIO 5   (digital output)
 *   - LED PWM       GPIO 19  (PWM output)
 *
 * Transport: Serial (USB-UART) at 115200 baud
 */

#include <McpIot.h>

McpDevice mcp("esp32-demo", "1.0.0");

void setup() {
  mcp.add_pin(2,  "builtin_led", MCP_DIGITAL_OUTPUT, "Built-in LED (GPIO 2)");
  mcp.add_pin(5,  "buzzer",      MCP_DIGITAL_OUTPUT, "Piezo Buzzer (GPIO 5)");
  mcp.add_pin(19, "led_pwm",     MCP_PWM_OUTPUT,     "PWM LED (GPIO 19)");

  mcp.begin(Serial, 115200);
}

void loop() {
  mcp.loop();
}
