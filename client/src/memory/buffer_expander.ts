import { McpUObservation } from "./types.js";

export function expandBufferSamples(args: {
  values: number[];
  receivedAtMs: number;
  sampleIntervalMs: number;
  sessionId: string;
  deviceId: string;
  resourceName: string;
  bufferBatchId: string;
}): McpUObservation[] {
  const {
    values,
    receivedAtMs,
    sampleIntervalMs,
    sessionId,
    deviceId,
    resourceName,
    bufferBatchId,
  } = args;

  const n = values.length;

  return values.map((value, i) => ({
    session_id: sessionId,
    device_id: deviceId,
    resource_name: resourceName,
    observation_type: "buffer_drain",
    value_num: value,
    unit: "raw",
    source: "get_pin_buffer",
    timestamp_ms: receivedAtMs - (n - 1 - i) * sampleIntervalMs,
    received_at_ms: receivedAtMs,
    estimated_timestamp: 1,
    buffer_batch_id: bufferBatchId,
    metadata_json: JSON.stringify({
      timestamp_inference: "received_at_minus_indexed_interval",
      sample_index: i,
      sample_count: n,
    }),
  }));
}
