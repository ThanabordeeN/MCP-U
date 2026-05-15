/**
 * transport.ts — Abstract transport + Serial and TCP implementations.
 * All transports use newline-delimited JSON-RPC 2.0 framing.
 */

import { SerialPort } from "serialport";
import { ReadlineParser } from "serialport";
import { createConnection, Socket } from "net";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceConfig {
  id: string;
  transport: "serial" | "tcp" | "mock";
  // serial
  port?: string;
  baud?: number;
  // tcp
  host?: string;
  port_num?: number; // renamed from "port" to avoid clash with serial port
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

// ---------------------------------------------------------------------------
// Abstract interface
// ---------------------------------------------------------------------------

export interface McpTransport {
  connect(): Promise<void>;
  call(method: string, params?: Record<string, unknown>, timeout_ms?: number): Promise<unknown>;
  get is_connected(): boolean;
  on_disconnect(cb: () => void): void;
  close(): void;
}

// ---------------------------------------------------------------------------
// Shared base (ID tracking + framing)
// ---------------------------------------------------------------------------

abstract class BaseTransport implements McpTransport {
  protected pending = new Map<number, Pending>();
  protected next_id = 1;
  protected disconnect_cb?: () => void;

  abstract connect(): Promise<void>;
  abstract get is_connected(): boolean;
  abstract close(): void;
  abstract write_line(line: string): void;

  on_disconnect(cb: () => void): void {
    this.disconnect_cb = cb;
  }

  call(method: string, params: Record<string, unknown> = {}, timeout_ms = 5000): Promise<unknown> {
    const id = this.next_id++;
    const request = JSON.stringify({ jsonrpc: "2.0", id, method, params });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (id=${id}) after ${timeout_ms}ms`));
      }, timeout_ms);

      this.pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject:  (err) => { clearTimeout(timer); reject(err); },
      });

      try {
        this.write_line(request + "\n");
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err as Error);
      }
    });
  }

  protected handle_line(line: string): void {
    if (!line) return;
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(line) as Record<string, unknown>; } catch { return; }

    const pending = this.pending.get(msg["id"] as number);
    if (!pending) return;
    this.pending.delete(msg["id"] as number);

    if (msg["error"]) {
      const err = msg["error"] as { code: number; message: string };
      pending.reject(new Error(`RPC error ${err.code}: ${err.message}`));
    } else {
      pending.resolve(msg["result"]);
    }
  }
}

// ---------------------------------------------------------------------------
// Serial transport (USB-UART)
// ---------------------------------------------------------------------------

export class SerialTransport extends BaseTransport {
  private port_instance?: SerialPort;

  constructor(private readonly path: string, private readonly baud: number = 115200) {
    super();
  }

  async connect(): Promise<void> {
    this.port_instance = new SerialPort({ path: this.path, baudRate: this.baud });
    const parser = this.port_instance.pipe(new ReadlineParser({ delimiter: "\n" }));
    parser.on("data", (line: string) => this.handle_line(line.trim()));
    this.port_instance.on("close", () => this.disconnect_cb?.());

    await new Promise<void>((resolve, reject) => {
      this.port_instance!.once("open", resolve);
      this.port_instance!.once("error", reject);
    });
  }

  get is_connected(): boolean {
    return this.port_instance?.isOpen ?? false;
  }

  write_line(line: string): void {
    this.port_instance?.write(line);
  }

  close(): void {
    if (this.port_instance?.isOpen) this.port_instance.close();
  }
}

// ---------------------------------------------------------------------------
// TCP transport (WiFi devices)
// ---------------------------------------------------------------------------

export class TcpTransport extends BaseTransport {
  private socket?: Socket;
  private buffer = "";

  constructor(private readonly host: string, private readonly port: number) {
    super();
  }

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.socket = createConnection({ host: this.host, port: this.port }, resolve);
      this.socket.once("error", reject);
      this.socket.on("close", () => this.disconnect_cb?.());
      this.socket.on("data", (chunk: Buffer) => {
        this.buffer += chunk.toString();
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";
        lines.forEach((l) => this.handle_line(l.trim()));
      });
    });
  }

  get is_connected(): boolean {
    return this.socket !== undefined && !this.socket.destroyed;
  }

  write_line(line: string): void {
    this.socket?.write(line);
  }

  close(): void {
    this.socket?.destroy();
  }
}

// ---------------------------------------------------------------------------
// Mock transport (Virtual Testing)
// ---------------------------------------------------------------------------

export class MockTransport implements McpTransport {
  private connected = false;
  private disconnect_cb?: () => void;
  private bufferPhase = 0;

  async connect(): Promise<void> {
    this.connected = true;
  }

  get is_connected(): boolean {
    return this.connected;
  }

  on_disconnect(cb: () => void): void {
    this.disconnect_cb = cb;
  }

  close(): void {
    this.connected = false;
    this.disconnect_cb?.();
  }

  async call(method: string, params: Record<string, unknown> = {}, timeout_ms = 5000): Promise<unknown> {
    if (!this.connected) throw new Error("Mock transport not connected");
    
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (method === "get_info") {
      return {
        device: "Virtual Mock MCU",
        version: "1.0.0-mock",
        platform: "virtual",
        pin_count: 40
      };
    }
    
    if (method === "list_tools") {
      return {
        tools: [
          {
            name: "set_led",
            description: "Turn LED on or off",
            inputSchema: {
              type: "object",
              properties: { state: { type: "boolean" } },
              required: ["state"]
            }
          }
        ],
        pins: [
          {
            pin: 2,
            name: "led",
            type: "gpio",
            description: "Onboard LED",
            capabilities: { buffer: false },
          },
          {
            pin: 34,
            name: "voltage_feedback",
            type: "adc",
            description: "Simulated voltage sensor",
            capabilities: { buffer: true },
            sampling: { interval_ms: 100, buffer_size: 50 }
          }
        ]
      };
    }
    
    if (method === "get_pin_buffer") {
      const pin = params.pin;
      const limit = (params.limit as number) || 50;
      if (pin === 34 || pin === "voltage_feedback") {
        const values = [];
        for (let i = 0; i < limit; i++) {
          // Generate a simulated noisy sine wave
          values.push(Number((3.3 + Math.sin(this.bufferPhase + i * 0.1) * 0.5 + (Math.random() * 0.1 - 0.05)).toFixed(3)));
        }
        this.bufferPhase += limit * 0.1;
        return { values, count: limit };
      }
      throw new Error(`Buffer not supported for pin ${pin}`);
    }

    if (method === "set_led") {
      return { success: true, state: params.state };
    }

    throw new Error(`Unknown method: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function create_transport(cfg: DeviceConfig): McpTransport {
  if (cfg.transport === "mock") {
    return new MockTransport();
  }
  if (cfg.transport === "tcp") {
    if (!cfg.host || !cfg.port_num) throw new Error(`Device ${cfg.id}: TCP transport requires host and port_num`);
    return new TcpTransport(cfg.host, cfg.port_num);
  }
  if (!cfg.port) throw new Error(`Device ${cfg.id}: serial transport requires port`);
  return new SerialTransport(cfg.port, cfg.baud ?? 115200);
}
