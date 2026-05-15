export const schemaSQL = `
CREATE TABLE IF NOT EXISTS mcp_u_sessions (
  session_id TEXT PRIMARY KEY,
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  client_version TEXT,
  memory_profile TEXT,
  transport_summary_json TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_devices (
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  device_name TEXT,
  firmware_version TEXT,
  platform TEXT,
  transport_type TEXT,
  transport_address TEXT,
  discovered_at_ms INTEGER NOT NULL,
  info_json TEXT,

  PRIMARY KEY (session_id, device_id)
);

CREATE TABLE IF NOT EXISTS mcp_u_resources (
  resource_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,

  resource_name TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  direction TEXT NOT NULL,

  pin INTEGER,
  unit TEXT,
  data_type TEXT,
  description TEXT,

  sampling_enabled INTEGER DEFAULT 0,
  sampling_interval_ms INTEGER,
  buffer_enabled INTEGER DEFAULT 0,
  buffer_size INTEGER,

  min_value REAL,
  max_value REAL,

  metadata_json TEXT,
  created_at_ms INTEGER NOT NULL,

  PRIMARY KEY (session_id, device_id, resource_id)
);

CREATE TABLE IF NOT EXISTS mcp_u_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  resource_id TEXT,
  resource_name TEXT,

  observation_type TEXT NOT NULL,

  value_num REAL,
  value_text TEXT,
  value_bool INTEGER,
  value_json TEXT,

  unit TEXT,
  quality TEXT,
  confidence REAL,

  source TEXT,
  sequence_no INTEGER,

  timestamp_ms INTEGER NOT NULL,
  received_at_ms INTEGER NOT NULL,
  estimated_timestamp INTEGER DEFAULT 0,

  buffer_batch_id TEXT,

  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,

  tool_name TEXT NOT NULL,
  tool_kind TEXT NOT NULL,

  call_source TEXT,
  params_json TEXT,
  result_json TEXT,
  error_json TEXT,

  status TEXT NOT NULL,
  latency_ms INTEGER,

  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,

  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_buffer_drains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  buffer_batch_id TEXT NOT NULL UNIQUE,

  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  pin INTEGER,

  sample_interval_ms INTEGER NOT NULL,
  buffer_size INTEGER,
  requested_limit INTEGER,
  returned_count INTEGER NOT NULL,

  drain_ratio REAL,
  estimated_window_start_ms INTEGER,
  estimated_window_end_ms INTEGER,

  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  latency_ms INTEGER,

  status TEXT NOT NULL,
  error_json TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_observation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session_id TEXT,
  device_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,

  window_start_ms INTEGER NOT NULL,
  window_end_ms INTEGER NOT NULL,
  window_ms INTEGER NOT NULL,

  sample_count INTEGER NOT NULL,
  min_value REAL,
  max_value REAL,
  avg_value REAL,
  std_value REAL,

  first_value REAL,
  last_value REAL,

  source TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_signal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  resource_id TEXT,
  resource_name TEXT,

  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,

  message TEXT,
  value_num REAL,
  value_json TEXT,

  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,

  source TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS mcp_u_action_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  session_id TEXT NOT NULL,
  device_id TEXT NOT NULL,

  tool_call_id INTEGER NOT NULL,

  expected_resource TEXT,
  expected_state_json TEXT,
  observed_state_json TEXT,

  verification_status TEXT NOT NULL,
  verification_method TEXT,

  checked_at_ms INTEGER NOT NULL,
  latency_after_action_ms INTEGER,

  evidence_json TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_obs_session_time
ON mcp_u_observations(session_id, timestamp_ms);

CREATE INDEX IF NOT EXISTS idx_obs_device_time
ON mcp_u_observations(device_id, timestamp_ms);

CREATE INDEX IF NOT EXISTS idx_obs_resource_time
ON mcp_u_observations(resource_name, timestamp_ms);

CREATE INDEX IF NOT EXISTS idx_obs_resource_value_time
ON mcp_u_observations(resource_name, value_num, timestamp_ms);

CREATE INDEX IF NOT EXISTS idx_obs_buffer_batch
ON mcp_u_observations(buffer_batch_id);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session_time
ON mcp_u_tool_calls(session_id, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_tool_calls_device_time
ON mcp_u_tool_calls(device_id, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_time
ON mcp_u_tool_calls(tool_name, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_buffer_drains_resource_time
ON mcp_u_buffer_drains(device_id, resource_name, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_signal_events_resource_time
ON mcp_u_signal_events(resource_name, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_summary_resource_window
ON mcp_u_observation_summaries(device_id, resource_name, window_start_ms);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_dedup_v1
ON mcp_u_observations(
  device_id,
  resource_name,
  timestamp_ms,
  source
);

CREATE VIEW IF NOT EXISTS latest_observations AS
SELECT *
FROM mcp_u_observations
ORDER BY timestamp_ms DESC;

CREATE VIEW IF NOT EXISTS numeric_observations AS
SELECT
  session_id,
  device_id,
  resource_name,
  observation_type,
  value_num,
  unit,
  quality,
  confidence,
  source,
  timestamp_ms,
  received_at_ms,
  estimated_timestamp
FROM mcp_u_observations
WHERE value_num IS NOT NULL;

CREATE VIEW IF NOT EXISTS device_signal_summary AS
SELECT
  device_id,
  resource_name,
  COUNT(*) AS sample_count,
  MIN(value_num) AS min_value,
  MAX(value_num) AS max_value,
  AVG(value_num) AS avg_value,
  MIN(timestamp_ms) AS first_seen_ms,
  MAX(timestamp_ms) AS last_seen_ms
FROM mcp_u_observations
WHERE value_num IS NOT NULL
GROUP BY device_id, resource_name;

CREATE VIEW IF NOT EXISTS latest_tool_calls AS
SELECT *
FROM mcp_u_tool_calls
ORDER BY started_at_ms DESC;

CREATE VIEW IF NOT EXISTS buffer_drain_health AS
SELECT
  device_id,
  resource_name,
  COUNT(*) AS drain_count,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS error_count,
  AVG(latency_ms) AS avg_latency_ms,
  MAX(completed_at_ms) AS last_completed_at_ms
FROM mcp_u_buffer_drains
GROUP BY device_id, resource_name;
`;
