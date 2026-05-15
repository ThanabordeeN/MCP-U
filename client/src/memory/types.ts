export interface BufferedPin {
  device_id: string;
  resource_name: string;
  resource_id?: string;
  pin?: number;

  sample_interval_ms: number;
  buffer_size: number;

  drain_ratio: number;
  drain_interval_ms: number;
}

export interface BufferDrainResult {
  buffer_batch_id: string;

  session_id: string;
  device_id: string;
  resource_name: string;
  pin?: number;

  sample_interval_ms: number;
  buffer_size?: number;
  requested_limit?: number;
  returned_count: number;

  values: number[];

  received_at_ms: number;
  started_at_ms: number;
  completed_at_ms: number;
  latency_ms: number;

  status: "ok" | "error";
  error?: unknown;
}

export interface McpUObservation {
  session_id: string;
  device_id: string;
  resource_id?: string | null;
  resource_name?: string | null;

  observation_type: string;

  value_num?: number | null;
  value_text?: string | null;
  value_bool?: number | null;
  value_json?: string | null;

  unit?: string | null;
  quality?: string | null;
  confidence?: number | null;

  source?: string | null;
  sequence_no?: number | null;

  timestamp_ms: number;
  received_at_ms: number;
  estimated_timestamp: number;

  buffer_batch_id?: string | null;

  metadata_json?: string | null;
}

export interface MemoryStore {
  connect(): Promise<void>;

  writeSession(session: unknown): Promise<void>;
  writeDevice(device: unknown): Promise<void>;
  writeResource(resource: unknown): Promise<void>;

  writeToolCall(call: unknown): Promise<number>;

  writeBufferDrain(drain: unknown): Promise<void>;
  writeObservations(rows: McpUObservation[]): Promise<void>;

  getStatus(): Promise<unknown>;
  cleanup(): Promise<void>;

  close(): Promise<void>;
}
