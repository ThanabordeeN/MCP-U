import test from 'node:test';
import assert from 'node:assert';
import { DeviceManager } from '../src/device_manager.js';
import { SqliteMemoryStore } from '../src/memory/sqlite_memory_store.js';
import { BufferDrainPoller } from '../src/memory/buffer_drain_poller.js';
import { BufferedPin } from '../src/memory/types.js';

test('BufferDrainPoller successfully polls Mock MCU and saves to memory', async (_t) => {
  // 1. Initialize DeviceManager with the Mock transport
  const manager = new DeviceManager([
    { id: 'test_mock_mcu', transport: 'mock' }
  ]);
  
  await manager.connect_all();
  const devices = manager.list();
  
  assert.strictEqual(devices.length, 1, 'Should have connected 1 device');
  const device = devices[0];
  
  assert.strictEqual(device.id, 'test_mock_mcu', 'Device ID should match');
  assert.ok(device.pins.length > 0, 'Device should have discovered pins');

  // 2. Setup SQLite Memory Store in-memory for testing
  const memory = new SqliteMemoryStore(':memory:');
  await memory.connect();

  const sessionId = 'test-session-123';
  await memory.writeSession({
    session_id: sessionId,
    started_at_ms: Date.now(),
    client_version: '1.1.0-test',
    memory_profile: 'debug'
  });

  // 3. Find buffered pins from the mock device
  const bufferedPins: BufferedPin[] = [];
  for (const pin of device.pins) {
    if (
      pin.capabilities?.buffer &&
      pin.sampling?.interval_ms &&
      pin.sampling?.buffer_size
    ) {
      bufferedPins.push({
        device_id: device.id,
        resource_name: pin.name,
        pin: pin.pin,
        sample_interval_ms: pin.sampling.interval_ms,
        buffer_size: pin.sampling.buffer_size,
        drain_ratio: 0.75,
        drain_interval_ms: 0,
      });
    }
  }

  assert.strictEqual(bufferedPins.length, 1, 'Should find 1 buffered pin (voltage_feedback)');

  // 4. Initialize and start the Poller
  const poller = new BufferDrainPoller(manager, memory, {
    sessionId,
    drainRatio: 0.75, // Usually would wait longer, but we will force a short interval or it runs immediately
    minIntervalMs: 50,
  });

  // The poller executes an immediate drain on start()
  poller.start(bufferedPins);

  // 5. Wait for the immediate drain to complete
  await new Promise((resolve) => setTimeout(resolve, 200));

  // 6. Verify data was persisted in SQLite
  const status = await memory.getStatus();
  assert.ok(status.enabled, 'Memory should be enabled');
  assert.strictEqual(status.observation_count, 50, 'Should have inserted exactly 50 observations from the buffer limit');

  // Verify Buffer Drain Health table
  const dbAny = memory as any;
  const drainRecords = dbAny.db.prepare('SELECT * FROM mcp_u_buffer_drains').all();
  assert.strictEqual(drainRecords.length, 1, 'Should have 1 buffer drain audit record');
  assert.strictEqual(drainRecords[0].status, 'ok', 'Drain status should be ok');
  assert.strictEqual(drainRecords[0].returned_count, 50, 'Should have returned 50 samples');

  // Verify Observation row content
  const firstObs = dbAny.db.prepare('SELECT * FROM mcp_u_observations ORDER BY timestamp_ms DESC LIMIT 1').get();
  assert.strictEqual(firstObs.device_id, 'test_mock_mcu');
  assert.strictEqual(firstObs.resource_name, 'voltage_feedback');
  assert.strictEqual(typeof firstObs.value_num, 'number');

  // 7. Cleanup
  poller.stop();
  await memory.close();
  manager.close_all();
});
