/**
 * device_manager.ts — Manages N MCU connections.
 * Connects to each device, discovers capabilities via list_tools,
 * and routes RPC calls by device id.
 */

import { McpTransport, DeviceConfig, create_transport } from "./transport.js";

// ---------------------------------------------------------------------------
// Discovery types (mirrors firmware list_tools response)
// ---------------------------------------------------------------------------

export interface PinInfo {
  pin: number;
  name: string;
  type: string;
  description: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface DeviceInfo {
  device?: string;
  version?: string;
  platform?: string;
  pin_count?: number;
}

interface DeviceEntry {
  transport: McpTransport;
  info: DeviceInfo;
  pins: PinInfo[];
  tools: ToolInfo[];
}

// ---------------------------------------------------------------------------
// DeviceManager
// ---------------------------------------------------------------------------

export class DeviceManager {
  private devices = new Map<string, DeviceEntry>();

  constructor(private readonly configs: DeviceConfig[]) {}

  /** Connect to all configured devices. Failed devices are logged but don't abort. */
  async connect_all(): Promise<void> {
    const results = await Promise.allSettled(
      this.configs.map((cfg) => this.connect_one(cfg))
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        process.stderr.write(
          `[device-manager] Failed to connect ${this.configs[i].id}: ${(r.reason as Error).message}\n`
        );
      }
    }

    if (this.devices.size === 0) {
      throw new Error("No devices connected");
    }
  }

  /** Returns all connected devices with full discovery info. */
  list(): Array<{ id: string } & DeviceEntry> {
    return Array.from(this.devices.entries()).map(([id, entry]) => ({ id, ...entry }));
  }

  /** Call a JSON-RPC method on a specific device by id. */
  async call(device_id: string, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const entry = this.devices.get(device_id);
    if (!entry) throw new Error(`Unknown device: ${device_id}`);
    return entry.transport.call(method, params);
  }

  close_all(): void {
    for (const { transport } of this.devices.values()) transport.close();
  }

  // ---------------------------------------------------------------------------

  private async connect_one(cfg: DeviceConfig): Promise<void> {
    const transport = create_transport(cfg);
    await transport.connect();

    // Give the MCU time to reset after DTR toggle (USB-serial resets ESP32)
    await new Promise<void>((r) => setTimeout(r, 600));

    const info = (await transport.call("get_info")) as DeviceInfo;
    const discovery = (await transport.call("list_tools")) as {
      tools?: ToolInfo[];
      pins?: PinInfo[];
    };

    this.devices.set(cfg.id, {
      transport,
      info,
      pins: discovery.pins ?? [],
      tools: discovery.tools ?? [],
    });

    process.stderr.write(
      `[device-manager] Connected: ${cfg.id} — ${(discovery.tools ?? []).length} tools, ${(discovery.pins ?? []).length} pins\n`
    );
  }
}
