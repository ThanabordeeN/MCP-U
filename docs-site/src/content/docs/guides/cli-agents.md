---
title: Connecting to CLI Agents
description: Add MCP/U to Claude Code, Gemini CLI, and OpenCode using the correct config for each tool.
---

Once your MCP/U client is running, connect it to any MCP-compatible CLI agent.

---

## Claude Code

**Official docs**: [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)

### Add via CLI (recommended)

**Serial:**
```bash
claude mcp add --env SERIAL_PORT=/dev/ttyACM0 mcpu -- npx mcpu-client
```

**WiFi TCP** (replace IP with the one your ESP32 printed to Serial Monitor):
```bash
claude mcp add --env DEVICES=mydevice:192.168.1.42:3000:tcp mcpu -- npx mcpu-client
```

All options (`--env`, `--scope`, `--transport`) must come **before** the server name. The `--` separator isolates the command passed to the MCP server.

### Or edit `.mcp.json` (shared with team)

**Serial:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "SERIAL_PORT": "/dev/ttyACM0"
      }
    }
  }
}
```

**WiFi TCP:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "DEVICES": "mydevice:192.168.1.42:3000:tcp"
      }
    }
  }
}
```

### Verify

```bash
claude mcp list
```

Or inside a Claude Code session: `/mcp`

---

## Gemini CLI

**Official docs**: [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

### Add via CLI (recommended)

**Serial:**
```bash
gemini mcp add -e SERIAL_PORT=/dev/ttyACM0 mcpu npx mcpu-client
```

**WiFi TCP** (replace IP with the one your ESP32 printed to Serial Monitor):
```bash
gemini mcp add -e DEVICES=mydevice:192.168.1.42:3000:tcp mcpu npx mcpu-client
```

### Or edit `~/.gemini/settings.json` directly

**Serial:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "SERIAL_PORT": "/dev/ttyACM0"
      }
    }
  }
}
```

**WiFi TCP:**
```json
{
  "mcpServers": {
    "mcpu": {
      "command": "npx",
      "args": ["mcpu-client"],
      "env": {
        "DEVICES": "mydevice:192.168.1.42:3000:tcp"
      }
    }
  }
}
```

### Verify

```bash
gemini mcp list
```

Or inside a session: `/mcp`

---

## OpenCode

**Official docs**: [opencode.ai/docs/mcp-servers](https://opencode.ai/docs/mcp-servers/)

OpenCode has no CLI add command — edit `opencode.json` directly.

**Serial:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcpu": {
      "type": "local",
      "command": ["npx", "mcpu-client"],
      "enabled": true,
      "environment": {
        "SERIAL_PORT": "/dev/ttyACM0"
      }
    }
  }
}
```

**WiFi TCP:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcpu": {
      "type": "local",
      "command": ["npx", "mcpu-client"],
      "enabled": true,
      "environment": {
        "DEVICES": "mydevice:192.168.1.42:3000:tcp"
      }
    }
  }
}
```

:::note
OpenCode uses `"environment"` (not `"env"`) and `"command"` must be an **array**.
:::

### Verify

```bash
opencode mcp list
```

---

## Summary

| | Serial | WiFi TCP |
|--|--------|----------|
| **Env var** | `SERIAL_PORT=/dev/ttyACM0` | `DEVICES=id:IP:port:tcp` |
| **Windows serial** | `SERIAL_PORT=COM3` | same TCP format |
| **Multi-device** | `DEVICES=a:/dev/ttyUSB0:115200,b:/dev/ttyACM0:115200` | `DEVICES=a:192.168.1.42:3000:tcp,b:192.168.1.43:3000:tcp` |

| | Claude Code | Gemini CLI | OpenCode |
|--|-------------|------------|----------|
| **Add command** | `claude mcp add --env KEY=VAL mcpu -- npx mcpu-client` | `gemini mcp add -e KEY=VAL mcpu npx mcpu-client` | manual config only |
| **Config file** | `.mcp.json` (project) | `~/.gemini/settings.json` | `opencode.json` |
| **Env field** | `"env"` | `"env"` | `"environment"` |
| **Command format** | string | string | array |
| **Verify** | `claude mcp list` / `/mcp` | `gemini mcp list` / `/mcp` | `opencode mcp list` |

---

## Finding your serial port

| OS | Typical port |
|----|-------------|
| Linux | `/dev/ttyUSB0` or `/dev/ttyACM0` |
| macOS | `/dev/cu.usbserial-*` |
| Windows | `COM3`, `COM4`, … |

```bash
# Linux / macOS
ls /dev/tty*
```

**Windows**: Device Manager → Ports (COM & LPT)
