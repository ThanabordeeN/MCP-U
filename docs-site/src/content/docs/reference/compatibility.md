---
title: Compatibility
description: Supported boards, platforms, Node.js versions, and known limitations.
---

## Firmware — McpIot Library

### Supported Boards

| Board / Platform | Serial | WiFi TCP | Bluetooth | PWM freq | ADC |
|-----------------|:------:|:--------:|:---------:|:--------:|:---:|
| ESP32 (all variants) | ✅ | ✅ | ✅ BLE Serial | ✅ | ✅ |
| ESP32-S2 | ✅ | ✅ | ❌ | ✅ | ✅ |
| ESP32-S3 | ✅ | ✅ | ✅ BLE Serial | ✅ | ✅ |
| ESP32-C3 | ✅ | ✅ | ✅ BLE Serial | ✅ | ✅ |
| ESP8266 (NodeMCU) | ✅ | ✅ | ❌ | ⚠️ fixed freq | ✅ |
| Arduino Uno (AVR) | ✅ | ❌ | ❌ | ⚠️ limited pins | ✅ |
| Arduino Mega (AVR) | ✅ | ❌ | ❌ | ⚠️ limited pins | ✅ |
| Arduino Nano | ✅ | ❌ | ❌ | ⚠️ limited pins | ✅ |
| RP2040 (Pico) | ✅ | ⚠️ Pico W | ❌ | ✅ | ✅ |
| STM32 (Arduino core) | ✅ | ❌ | ❌ | ✅ | ✅ |

**Legend:** ✅ Fully supported · ⚠️ Partial / limited · ❌ Not available

---

### Platform Notes

#### ESP32 (Full Support)
- All 4 pin types: `digital_output`, `digital_input`, `pwm_output`, `adc_input`
- All 3 transports: Serial, WiFiClient, BluetoothSerial
- `analogWriteFrequency()` for PWM frequency control
- Up to 32 pins / 32 tools (configurable via `MCP_MAX_PINS`, `MCP_MAX_TOOLS`)

#### ESP8266
- Serial and WiFiClient transports ✅
- No Bluetooth ❌
- PWM frequency is fixed (~1kHz) — `freq` param accepted but ignored ⚠️
- ADC: only 1 analog pin (A0) ⚠️

#### AVR (Uno, Mega, Nano)
- Serial only ✅
- No WiFi or Bluetooth ❌
- PWM only on specific pins (3, 5, 6, 9, 10, 11 on Uno) ⚠️
- Limited RAM — lower limits recommended ⚠️
```cpp
#define MCP_MAX_PINS  8
#define MCP_MAX_TOOLS 8
```
- ArduinoJson v7 requires at least 2KB SRAM — Uno is very tight ⚠️

---

### Not Supported (Firmware)

| Feature | Status | Reason |
|---------|--------|--------|
| Async / non-blocking I/O | ❌ | Arduino `loop()` is single-threaded |
| SPI built-in tools | ❌ | Implement as custom tools |
| UART passthrough | ❌ | Out of scope |
| OTA firmware update | ❌ | Out of scope |
| JSON Schema: arrays, nested objects | ❌ | MCU RAM constraints |
| JSON Schema: `$ref`, `anyOf`, `allOf` | ❌ | Same reason |
| WebSocket transport | ❌ | Not in v1.0 |
| mDNS / Zeroconf discovery | ❌ | Not in v1.0 |
| String IDs in JSON-RPC `id` field | ⚠️ | Parsed as int; string IDs truncate to 0 |

---

## MCP Client (TypeScript)

### Supported Node.js Versions

| Version | Status |
|---------|--------|
| Node 22 LTS | ✅ Recommended |
| Node 20 LTS | ✅ Supported |
| Node 18 LTS | ✅ Supported |
| Node < 18 | ❌ ES2022 + top-level await required |

### Supported Transport Config

| Transport | `devices.json` format | Env var format |
|-----------|----------------------|----------------|
| Serial (USB/UART) | `"transport":"serial","port":"/dev/ttyUSB0","baud":115200` | `id:/dev/ttyUSB0:115200` |
| TCP (WiFi) | `"transport":"tcp","host":"192.168.1.50","port_num":3000` | `id:192.168.1.50:3000:tcp` |

### Supported OS

| OS | Serial | TCP |
|----|:------:|:---:|
| Linux | ✅ `/dev/ttyUSB*`, `/dev/ttyACM*` | ✅ |
| macOS | ✅ `/dev/tty.usbserial-*` | ✅ |
| Windows | ✅ `COM3`, `COM4`, ... | ✅ |

### Not Supported (Client)

| Feature | Status | Notes |
|---------|--------|-------|
| Auto port detection | ❌ | Explicit config required in v1.0 |
| Hot-plug reconnect | ❌ | Restart client to reconnect |
| BLE over Node.js | ❌ | Bluetooth only works over BluetoothSerial (Classic) |
| HTTP / SSE transport | ❌ | stdio only in v1.0 |
| Nested Zod schemas | ❌ | Flat schemas only (mirrors firmware constraint) |
| Parallel requests to same device | ⚠️ | Works (ID matching), but no queue |
