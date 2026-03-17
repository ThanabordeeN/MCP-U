# MCP/U Protocol Specification v1.0

## Overview

MCP-IoT uses **JSON-RPC 2.0** over a **newline-delimited stream** (Serial, TCP, or Bluetooth). Each message is a single JSON object terminated by `\n`.

---

## Transport

- **Primary**: UART Serial at 115200 baud
- **Secondary**: TCP (WiFi devices listen on a configurable port)
- **Bluetooth**: BluetoothSerial (ESP32 only)
- **Framing**: Each message ends with `\n`. Messages must not contain embedded newlines.

---

## Request Format

```json
{"jsonrpc": "2.0", "id": 1, "method": "gpio_write", "params": {"pin": 2, "value": true}}
```

| Field      | Type            | Required | Description                            |
|------------|-----------------|----------|----------------------------------------|
| `jsonrpc`  | string `"2.0"`  | Yes      | JSON-RPC version                       |
| `id`       | integer/string  | Yes      | Request identifier (echoed in response)|
| `method`   | string          | Yes      | Tool/method name                       |
| `params`   | object          | No       | Method parameters                      |

> Requests without `id` are treated as notifications and receive no response.

---

## Response Format

**Success:**
```json
{"jsonrpc": "2.0", "id": 1, "result": {"pin": 2, "name": "led", "value": true}}
```

**Error:**
```json
{"jsonrpc": "2.0", "id": 1, "error": {"code": -32602, "message": "Required: pin (integer), value (boolean)"}}
```

---

## Error Codes

| Code    | Meaning           | When                                     |
|---------|-------------------|------------------------------------------|
| -32700  | Parse error       | Invalid JSON received                    |
| -32600  | Invalid request   | Missing `jsonrpc` or `method`            |
| -32601  | Method not found  | Unknown method name                      |
| -32602  | Invalid params    | Missing or wrong-typed parameter         |

---

## Built-in Methods

### `get_info`

Returns device metadata.

**Request:** `{"jsonrpc":"2.0","id":1,"method":"get_info"}`

**Response:**
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "device": "esp32-demo",
    "version": "1.0.0",
    "platform": "arduino",
    "pin_count": 3
  }
}
```

---

### `list_tools`

Discovery endpoint. Returns all tools with JSON Schema + pin registry.

**Request:** `{"jsonrpc":"2.0","id":1,"method":"list_tools"}`

**Response:**
```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "device": "esp32-demo",
    "version": "1.0.0",
    "tools": [
      {
        "name": "gpio_write",
        "description": "Write HIGH or LOW to a digital output pin",
        "inputSchema": {
          "type": "object",
          "properties": {
            "pin":   { "type": "integer", "description": "GPIO pin number" },
            "value": { "type": "boolean", "description": "true = HIGH, false = LOW" }
          },
          "required": ["pin", "value"]
        }
      },
      {
        "name": "hello",
        "description": "Returns a greeting from the device",
        "inputSchema": { "type": "object", "properties": {}, "required": [] }
      }
    ],
    "pins": [
      { "pin": 2,  "name": "led",    "type": "digital_output", "description": "Onboard LED" },
      { "pin": 5,  "name": "buzzer", "type": "digital_output", "description": "Piezo Buzzer" },
      { "pin": 34, "name": "sensor", "type": "adc_input",      "description": "Analog Sensor" }
    ]
  }
}
```

---

### `gpio_write`

**Params:** `{ "pin": <integer>, "value": <boolean> }`

**Response:** `{ "pin": 2, "name": "led", "value": true }`

---

### `gpio_read`

**Params:** `{ "pin": <integer> }`

**Response:** `{ "pin": 2, "name": "led", "value": true }`

---

### `pwm_write`

**Params:** `{ "pin": <integer>, "duty": <0–255>, "freq": <Hz> }`

**Response:** `{ "pin": 9, "name": "motor", "duty": 128, "freq": 1000 }`

---

### `adc_read`

**Params:** `{ "pin": <integer> }`

**Response:** `{ "pin": 34, "name": "sensor", "value": 2048, "volts": 1.65 }`

---

## Pin Types

| Type string       | Meaning                     | Valid operations              |
|-------------------|-----------------------------|-------------------------------|
| `digital_output`  | Digital write pin           | `gpio_write`, `gpio_read`     |
| `digital_input`   | Digital read pin            | `gpio_read`                   |
| `pwm_output`      | PWM output pin              | `pwm_write`                   |
| `adc_input`       | Analog input pin            | `adc_read`                    |

---

## Discovery Sequence

```
Client                          MCU
  │                              │
  │── connect (serial/TCP) ─────►│
  │── get_info ─────────────────►│
  │◄─ {device, version, ...} ───│
  │── list_tools ───────────────►│
  │◄─ {tools[], pins[]} ────────│
  │                              │
  │  (register MCP tools)        │
  │                              │
  │── gpio_write {pin:2,value:1}►│
  │◄─ {pin:2, name:"led", ...} ─│
```
