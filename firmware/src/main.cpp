/**
 * MCP/U — ESP32 Demo Firmware
 * By 2edge.co — LGPL-3.0
 *
 * Demonstrates all three custom tool patterns:
 *   1. On-demand read  — get_temperature
 *   2. Parameterized action — set_brightness
 *   3. Auto-polled buffer  — read_touch (McpPolling)
 *
 * Hardware:
 *   GPIO 2  — built-in LED    (digital output)
 *   GPIO 5  — buzzer          (digital output)
 *   GPIO 19 — PWM LED         (PWM output)
 *   GPIO 34 — ADC / LM35      (analog input, ADC1 — WiFi-safe)
 *   GPIO 4  — capacitive touch (touch-capable pin)
 *
 * Transport: Serial (USB-UART) at 115200 baud
 */

#include <MCP-U.h>

// ---------------------------------------------------------------------------
// McpDevice declaration
// ---------------------------------------------------------------------------

McpDevice mcp("esp32-demo", "1.0.0");

// ---------------------------------------------------------------------------
// Pattern 3: circular touch buffer (file scope — filled in loop())
// ---------------------------------------------------------------------------

#define TOUCH_PIN          4
#define TOUCH_BUF_SIZE    20
#define TOUCH_INTERVAL_MS 200
#define TOUCH_THRESHOLD   40

static int      touch_buf[TOUCH_BUF_SIZE];
static uint32_t touch_ts[TOUCH_BUF_SIZE];
static uint8_t  touch_head  = 0;
static uint8_t  touch_count = 0;
static uint32_t last_touch_sample = 0;

// ---------------------------------------------------------------------------
// Pattern 1 — On-demand read
// AI calls get_temperature; MCU reads LM35 on GPIO34 and returns a value.
// ---------------------------------------------------------------------------

void handle_get_temperature(int id, JsonObject params) {
  int raw = analogRead(34);
  if (raw < 10) {
    mcp.send_error(id, -32602, "Sensor not connected");
    return;
  }
  float v    = raw * 3.3f / 4095.0f;
  float temp = (v - 0.5f) * 100.0f;   // LM35: 10 mV/°C, 0.5 V offset

  JsonDocument res;
  res["result"]["temperature_c"] = temp;
  res["result"]["raw_adc"]       = raw;
  mcp.send_result(id, res);
}

// ---------------------------------------------------------------------------
// Pattern 2 — Parameterized action
// AI sends { "duty": 0-255 }; MCU validates and sets LED brightness.
// ---------------------------------------------------------------------------

void handle_set_brightness(int id, JsonObject params) {
  if (!params["duty"].is<int>()) {
    mcp.send_error(id, -32602, "Missing param: duty (integer 0-255)");
    return;
  }
  int duty = params["duty"].as<int>();
  if (duty < 0 || duty > 255) {
    mcp.send_error(id, -32602, "duty must be 0-255");
    return;
  }
  analogWrite(19, duty);

  JsonDocument res;
  res["result"]["duty"] = duty;
  res["result"]["pct"]  = (duty * 100) / 255;
  mcp.send_result(id, res);
}

// ---------------------------------------------------------------------------
// Pattern 3 — Auto-polled buffer
// Client calls read_touch every 2 s (declared via McpPolling below).
// Handler dumps the circular buffer; client stores values in memory DB.
// ---------------------------------------------------------------------------

void handle_read_touch(int id, JsonObject params) {
  JsonDocument res;
  res["result"]["type"]               = "buffer";
  res["result"]["resource"]           = "touch_gpio4";
  res["result"]["sample_interval_ms"] = TOUCH_INTERVAL_MS;

  uint8_t n = touch_count;
  for (uint8_t i = 0; i < n; i++) {
    uint8_t idx = (touch_head - n + i + TOUCH_BUF_SIZE) % TOUCH_BUF_SIZE;
    res["result"]["values"][i]  = touch_buf[idx];
    res["result"]["touched"][i] = (touch_buf[idx] < TOUCH_THRESHOLD);
  }
  mcp.send_result(id, res);
}

// ---------------------------------------------------------------------------
// setup / loop
// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  pinMode(19, OUTPUT);

  // Built-in pin registry (used by gpio_write, gpio_read, adc_read, etc.)
  mcp.add_pin(2,  "builtin_led", MCP_DIGITAL_OUTPUT, "Built-in LED");
  mcp.add_pin(5,  "buzzer",      MCP_DIGITAL_OUTPUT, "Piezo buzzer");
  mcp.add_pin(19, "led_pwm",     MCP_PWM_OUTPUT,     "PWM LED");
  mcp.add_pin(34, "adc_lm35",   MCP_ADC_INPUT,      "LM35 temperature sensor",
              McpBuffered(20, 500));  // also keep a rolling ADC buffer

  // Custom tools
  mcp.add_tool("get_temperature",
               "Read LM35 temperature on GPIO34. Returns temperature_c and raw_adc.",
               handle_get_temperature);

  mcp.add_tool("set_brightness",
               "Set PWM LED brightness on GPIO19. Param: duty (integer 0-255).",
               handle_set_brightness);

  mcp.add_tool("read_touch",
               "Read capacitive touch on GPIO4. Returns buffer of raw values and touched flags. "
               "resource=touch_gpio4, sample_interval_ms=200.",
               handle_read_touch,
               McpPolling(2000));   // client polls every 2 s automatically

  mcp.begin(Serial, 115200);
}

void loop() {
  mcp.loop();

  // Fill touch circular buffer non-blocking
  if (millis() - last_touch_sample >= TOUCH_INTERVAL_MS) {
    last_touch_sample = millis();
    touch_buf[touch_head] = touchRead(TOUCH_PIN);
    touch_ts[touch_head]  = millis();
    touch_head = (touch_head + 1) % TOUCH_BUF_SIZE;
    if (touch_count < TOUCH_BUF_SIZE) touch_count++;
  }
}
