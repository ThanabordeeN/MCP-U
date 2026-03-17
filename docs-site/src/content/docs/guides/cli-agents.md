---
title: Connecting to CLI Agents
description: Add your MCP/U device server to Claude Code, Gemini CLI, OpenCode, and other terminal AI agents.
---

Once your MCP/U client is running, connect it to any MCP-compatible CLI agent using the commands below.

---

## Claude Code

[Claude Code](https://code.claude.com/docs/en/mcp) (by Anthropic) connects to MCP servers directly from the terminal.

### Add via command

```bash
# Local stdio server
claude mcp add mcpu -- node /path/to/client/dist/index.js

# Remote HTTP server
claude mcp add --transport http mcpu http://localhost:3000
```

### Add via JSON config

```bash
claude mcp add-json mcpu '{
  "command": "node",
  "args": ["/path/to/client/dist/index.js"],
  "env": { "SERIAL_PORT": "/dev/ttyUSB0" }
}'
```

### Verify

Run `/mcp` inside a Claude Code session to see active servers and their tools.

---

## Gemini CLI

[Gemini CLI](https://docs.cloud.google.com/gemini/docs/codeassist/gemini-cli) supports MCP for tool-augmented tasks.

### Add via command

```bash
gemini mcp add mcpu node /path/to/client/dist/index.js
```

### Add via config file

Edit `.gemini/settings.json` (or `settings.json` in your project root):

```json
{
  "mcpServers": {
    "mcpu": {
      "command": "node",
      "args": ["/path/to/client/dist/index.js"],
      "env": { "SERIAL_PORT": "/dev/ttyUSB0" }
    }
  }
}
```

### Verify

```bash
gemini mcp list
# or type /mcp inside a Gemini CLI session
```

---

## OpenCode

[OpenCode](https://opencode.ai) is an open-source terminal agent with native MCP support.

### Add via command

```bash
opencode mcp add
# Interactive prompt guides you through local or remote setup
```

### Add via config file

Edit `opencode.jsonc` in your project root:

```jsonc
{
  "mcp": {
    "mcpu": {
      "enabled": true,
      "command": "node",
      "args": ["/path/to/client/dist/index.js"],
      "env": { "SERIAL_PORT": "/dev/ttyUSB0" }
    }
  }
}
```

### Verify

```bash
opencode mcp list
```

---

## Finding the right `SERIAL_PORT`

| OS | Typical port |
|----|-------------|
| Linux | `/dev/ttyUSB0` or `/dev/ttyACM0` |
| macOS | `/dev/cu.usbserial-*` |
| Windows | `COM3`, `COM4`, … |

Use `ls /dev/tty*` (Linux/macOS) or Device Manager (Windows) to find your port.
