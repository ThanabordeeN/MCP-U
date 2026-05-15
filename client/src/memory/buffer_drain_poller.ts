import { DeviceManager } from "../device_manager.js";
import { MemoryStore, BufferedPin } from "./types.js";
import { expandBufferSamples } from "./buffer_expander.js";

export function computeDrainIntervalMs(args: {
  bufferSize: number;
  sampleIntervalMs: number;
  drainRatio: number;
  minIntervalMs: number;
}): number {
  const capacityMs = args.bufferSize * args.sampleIntervalMs;
  const interval = Math.floor(capacityMs * args.drainRatio);
  return Math.max(args.minIntervalMs, interval);
}

export class BufferDrainPoller {
  private timers = new Map<string, NodeJS.Timeout>();
  private running = new Set<string>();

  constructor(
    private readonly manager: DeviceManager,
    private readonly memory: MemoryStore,
    private readonly config: {
      sessionId: string;
      drainRatio: number;
      minIntervalMs: number;
    }
  ) {}

  start(bufferedPins: BufferedPin[]) {
    for (const pin of bufferedPins) {
      const key = `${pin.device_id}:${pin.resource_name}`;

      const intervalMs = computeDrainIntervalMs({
        bufferSize: pin.buffer_size,
        sampleIntervalMs: pin.sample_interval_ms,
        drainRatio: this.config.drainRatio,
        minIntervalMs: this.config.minIntervalMs,
      });

      const timer = setInterval(() => {
        void this.drainOne(pin);
      }, intervalMs);

      this.timers.set(key, timer);

      // Optional immediate first drain after startup
      void this.drainOne(pin);
    }
  }

  private async drainOne(pin: BufferedPin) {
    const key = `${pin.device_id}:${pin.resource_name}`;

    if (this.running.has(key)) return;
    this.running.add(key);

    const startedAtMs = Date.now();
    const batchId = `drain_${pin.device_id}_${pin.resource_name}_${startedAtMs}`;

    try {
      const result = await this.manager.call(
        pin.device_id,
        "get_pin_buffer",
        {
          pin: pin.pin ?? pin.resource_name,
          limit: pin.buffer_size,
        }
      ) as { values?: number[]; count?: number };

      const completedAtMs = Date.now();
      const values = result.values ?? [];
      const receivedAtMs = completedAtMs;

      const rows = expandBufferSamples({
        values,
        receivedAtMs,
        sampleIntervalMs: pin.sample_interval_ms,
        sessionId: this.config.sessionId,
        deviceId: pin.device_id,
        resourceName: pin.resource_name,
        bufferBatchId: batchId,
      });

      await this.memory.writeObservations(rows);

      await this.memory.writeBufferDrain({
        buffer_batch_id: batchId,
        session_id: this.config.sessionId,
        device_id: pin.device_id,
        resource_name: pin.resource_name,
        pin: pin.pin ?? null,
        sample_interval_ms: pin.sample_interval_ms,
        buffer_size: pin.buffer_size,
        requested_limit: pin.buffer_size,
        returned_count: values.length,
        drain_ratio: this.config.drainRatio,
        estimated_window_start_ms: rows[0]?.timestamp_ms ?? null,
        estimated_window_end_ms: rows[rows.length - 1]?.timestamp_ms ?? null,
        started_at_ms: startedAtMs,
        completed_at_ms: completedAtMs,
        latency_ms: completedAtMs - startedAtMs,
        status: "ok",
        error_json: null,
        metadata_json: null,
      });
    } catch (err) {
      const completedAtMs = Date.now();

      await this.memory.writeBufferDrain({
        buffer_batch_id: batchId,
        session_id: this.config.sessionId,
        device_id: pin.device_id,
        resource_name: pin.resource_name,
        pin: pin.pin ?? null,
        sample_interval_ms: pin.sample_interval_ms,
        buffer_size: pin.buffer_size,
        requested_limit: pin.buffer_size,
        returned_count: 0,
        drain_ratio: this.config.drainRatio,
        estimated_window_start_ms: null,
        estimated_window_end_ms: null,
        started_at_ms: startedAtMs,
        completed_at_ms: completedAtMs,
        latency_ms: completedAtMs - startedAtMs,
        status: "error",
        error_json: JSON.stringify({
          message: err instanceof Error ? err.message : String(err),
        }),
        metadata_json: null,
      });
    } finally {
      this.running.delete(key);
    }
  }

  stop() {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }
}
