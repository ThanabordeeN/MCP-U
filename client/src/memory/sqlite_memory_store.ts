import Database from 'better-sqlite3';
import { MemoryStore, McpUObservation } from './types.js';
import { schemaSQL } from './schema.js';
import { config } from './config.js';

export class SqliteMemoryStore implements MemoryStore {
  private db: Database.Database | null = null;
  private isCleanupRunning = false;

  constructor(private dbPath: string = config.MEMORY_CONNECTION_URL.replace('sqlite:///', '')) {}

  async connect(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(schemaSQL);
  }

  async writeSession(session: any): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mcp_u_sessions (session_id, started_at_ms, client_version, memory_profile)
      VALUES (@session_id, @started_at_ms, @client_version, @memory_profile)
    `);
    stmt.run(session);
  }

  async writeDevice(device: any): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mcp_u_devices (device_id, session_id, device_name, firmware_version, platform, transport_type, transport_address, discovered_at_ms, info_json)
      VALUES (@device_id, @session_id, @device_name, @firmware_version, @platform, @transport_type, @transport_address, @discovered_at_ms, @info_json)
    `);
    stmt.run(device);
  }

  async writeResource(resource: any): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mcp_u_resources (
        resource_id, session_id, device_id, resource_name, resource_type, direction, pin, unit, data_type, description, sampling_enabled, sampling_interval_ms, buffer_enabled, buffer_size, metadata_json, created_at_ms
      ) VALUES (
        @resource_id, @session_id, @device_id, @resource_name, @resource_type, @direction, @pin, @unit, @data_type, @description, @sampling_enabled, @sampling_interval_ms, @buffer_enabled, @buffer_size, @metadata_json, @created_at_ms
      )
    `);
    stmt.run(resource);
  }

  async writeToolCall(call: any): Promise<number> {
    if (!this.db) return 0;
    const stmt = this.db.prepare(`
      INSERT INTO mcp_u_tool_calls (session_id, device_id, tool_name, tool_kind, call_source, params_json, result_json, error_json, status, latency_ms, started_at_ms, completed_at_ms, metadata_json)
      VALUES (@session_id, @device_id, @tool_name, @tool_kind, @call_source, @params_json, @result_json, @error_json, @status, @latency_ms, @started_at_ms, @completed_at_ms, @metadata_json)
    `);
    const result = stmt.run(call);
    return result.lastInsertRowid as number;
  }

  async writeBufferDrain(drain: any): Promise<void> {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO mcp_u_buffer_drains (
        buffer_batch_id, session_id, device_id, resource_name, pin, sample_interval_ms, buffer_size, requested_limit, returned_count, drain_ratio, estimated_window_start_ms, estimated_window_end_ms, started_at_ms, completed_at_ms, latency_ms, status, error_json, metadata_json
      ) VALUES (
        @buffer_batch_id, @session_id, @device_id, @resource_name, @pin, @sample_interval_ms, @buffer_size, @requested_limit, @returned_count, @drain_ratio, @estimated_window_start_ms, @estimated_window_end_ms, @started_at_ms, @completed_at_ms, @latency_ms, @status, @error_json, @metadata_json
      )
    `);
    stmt.run(drain);
  }

  async writeObservations(rows: McpUObservation[]): Promise<void> {
    if (!this.db || rows.length === 0) return;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO mcp_u_observations (
        session_id, device_id, resource_id, resource_name, observation_type, value_num, value_text, value_bool, value_json, unit, quality, confidence, source, sequence_no, timestamp_ms, received_at_ms, estimated_timestamp, buffer_batch_id, metadata_json
      ) VALUES (
        @session_id, @device_id, @resource_id, @resource_name, @observation_type, @value_num, @value_text, @value_bool, @value_json, @unit, @quality, @confidence, @source, @sequence_no, @timestamp_ms, @received_at_ms, @estimated_timestamp, @buffer_batch_id, @metadata_json
      )
    `);
    
    // Provide default nulls for undefined properties to avoid SQLite parameter errors
    const normalizedRows = rows.map(r => ({
        session_id: r.session_id,
        device_id: r.device_id,
        resource_id: r.resource_id ?? null,
        resource_name: r.resource_name ?? null,
        observation_type: r.observation_type,
        value_num: r.value_num ?? null,
        value_text: r.value_text ?? null,
        value_bool: r.value_bool ?? null,
        value_json: r.value_json ?? null,
        unit: r.unit ?? null,
        quality: r.quality ?? null,
        confidence: r.confidence ?? null,
        source: r.source ?? null,
        sequence_no: r.sequence_no ?? null,
        timestamp_ms: r.timestamp_ms,
        received_at_ms: r.received_at_ms,
        estimated_timestamp: r.estimated_timestamp,
        buffer_batch_id: r.buffer_batch_id ?? null,
        metadata_json: r.metadata_json ?? null,
    }));

    const insertMany = this.db.transaction((items) => {
      for (const item of items) stmt.run(item);
    });
    insertMany(normalizedRows);
  }

  async getStatus(): Promise<any> {
    if (!this.db) return { enabled: false };
    const rowCount = this.db.prepare('SELECT COUNT(*) as count FROM mcp_u_observations').get() as { count: number };
    return {
      enabled: true,
      driver: 'sqlite',
      dbPath: this.dbPath,
      retention_hours: config.RAW_RETENTION_HOURS,
      observation_count: rowCount.count
    };
  }

  async cleanup(): Promise<void> {
    if (!this.db || this.isCleanupRunning) return;
    this.isCleanupRunning = true;
    try {
      const now = Date.now();
      const obsThreshold = now - (config.RAW_RETENTION_HOURS * 3600000);
      const toolCallThreshold = now - (config.TOOL_CALL_RETENTION_DAYS * 86400000);
      
      this.db.prepare('DELETE FROM mcp_u_observations WHERE timestamp_ms < ?').run(obsThreshold);
      this.db.prepare('DELETE FROM mcp_u_tool_calls WHERE started_at_ms < ?').run(toolCallThreshold);
    } finally {
      this.isCleanupRunning = false;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
