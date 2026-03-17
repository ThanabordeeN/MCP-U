---
title: Connecting to CLI Agents
description: Add MCP/U to Claude Code, Gemini CLI, and OpenCode using the correct config for each tool.
---

Once your MCP/U client is running, connect it to any MCP-compatible CLI agent.

---

## Claude Code

**Official docs**: [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)

### Add via CLI (recommended)

```bash
claude mcp add -e SERIAL_PORT=/dev/ttyACM0 -- npx mcpu-client
```

All flags must come **before** the server name. The `--` separator isolates the MCP command.

### Or edit `.mcp.json` (shared with team)

Create `.mcp.json` in your project root:

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

### Verify

```bash
claude mcp list
```

Or inside a Claude Code session: `/mcp`

---

## Gemini CLI

**Official docs**: [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

### Add via CLI

```bash
gemini mcp add mcpu --command "npx mcpu-client"
```

Then add the `env` field in `~/.gemini/settings.json`:

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

### Verify

```bash
gemini mcp list
```

Or inside a session: `/mcp`

---

## OpenCode

**Official docs**: [opencode.ai/docs/mcp-servers](https://opencode.ai/docs/mcp-servers/)

OpenCode has no CLI add command — edit `opencode.json` directly.

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

:::note
OpenCode uses `"environment"` (not `"env"`) and `"command"` must be an **array**.
:::

### Verify

```bash
opencode mcp list
```

---

## Summary

| | Claude Code | Gemini CLI | OpenCode |
|--|-------------|------------|----------|
| **Add command** | `claude mcp add -e KEY=VAL -- npx mcpu-client` | `gemini mcp add mcpu --command "npx mcpu-client"` | manual config only |
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
