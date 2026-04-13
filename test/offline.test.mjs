import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startBroker, spawnSimulator, collectMessages } from './helpers.mjs';

describe('offline scenario', () => {
  let brokerCtx;
  let messages;

  before(async () => {
    brokerCtx = await startBroker();

    // Start collecting before spawning so we don't miss the first message
    const collecting = collectMessages({
      brokerUrl: brokerCtx.url,
      topics: [
        'sys/product/+/status',
        'thing/product/+/state',
        'thing/product/+/osd',
      ],
      until: (msgs) => {
        // Stop when we see the offline status (second status message)
        const statusMsgs = msgs.filter(m => m.topic.includes('/status'));
        return statusMsgs.length >= 2;
      },
      timeoutMs: 30000,
    });

    const child = spawnSimulator({
      brokerUrl: brokerCtx.url,
      scenario: 'offline',
      gateway: 'TEST-GW-001',
      device: 'TEST-DEV-001',
    });

    // Capture stderr for debugging if needed
    child.stderr.on('data', (d) => process.stderr.write(d));

    messages = await collecting;

    // Wait for child to exit
    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(() => { child.kill(); resolve(); }, 5000);
    });
  });

  after(async () => {
    if (brokerCtx) await brokerCtx.close();
  });

  it('produces correct 4-message sequence: status(online) -> state -> osd -> status(offline)', () => {
    assert.equal(messages.length, 4, `Expected 4 messages, got ${messages.length}: ${messages.map(m => m.topic).join(', ')}`);

    // Message 0: status online
    assert.match(messages[0].topic, /sys\/product\/TEST-GW-001\/status/);
    assert.equal(messages[0].payload.method, 'update_topo');
    assert.equal(messages[0].payload.data.sub_devices.length, 1, 'Online status should have 1 sub_device');

    // Message 1: state with firmware
    assert.match(messages[1].topic, /thing\/product\/TEST-DEV-001\/state/);
    assert.equal(messages[1].payload.data.firmware_version, '07.01.10.01');

    // Message 2: OSD with position
    assert.match(messages[2].topic, /thing\/product\/TEST-DEV-001\/osd/);
    assert.equal(typeof messages[2].payload.latitude, 'number');

    // Message 3: status offline
    assert.match(messages[3].topic, /sys\/product\/TEST-GW-001\/status/);
    assert.equal(messages[3].payload.method, 'update_topo');
    assert.equal(messages[3].payload.data.sub_devices.length, 0, 'Offline status should have 0 sub_devices');
  });

  it('OSD message contains all 30+ required fields with correct types', () => {
    const osdMsg = messages.find(m => m.topic.includes('/osd'));
    assert.ok(osdMsg, 'OSD message not found');
    const osd = osdMsg.payload;

    // Top-level number fields (18 fields)
    const topLevelNumbers = [
      'latitude', 'longitude', 'height', 'elevation',
      'attitude_head', 'attitude_roll', 'attitude_pitch',
      'horizontal_speed', 'vertical_speed', 'wind_speed',
      'mode_code', 'gear',
      'home_distance', 'home_latitude', 'home_longitude',
      'total_flight_time', 'total_flight_distance', 'night_lights_state',
    ];

    for (const field of topLevelNumbers) {
      assert.equal(typeof osd[field], 'number', `${field} should be a number, got ${typeof osd[field]}`);
    }

    // Top-level object fields (5 objects)
    const topLevelObjects = ['battery', 'position_state', 'storage', 'obstacle_avoidance', 'maintain_status'];
    for (const field of topLevelObjects) {
      assert.equal(typeof osd[field], 'object', `${field} should be an object`);
      assert.ok(osd[field] !== null, `${field} should not be null`);
    }

    // Total top-level keys: 18 numbers + 5 objects = 23
    assert.ok(Object.keys(osd).length >= 23, `Expected at least 23 top-level keys, got ${Object.keys(osd).length}`);

    // battery nested structure
    assert.equal(typeof osd.battery.capacity_percent, 'number');
    assert.equal(typeof osd.battery.landing_power, 'number');
    assert.equal(typeof osd.battery.return_home_power, 'number');
    assert.ok(Array.isArray(osd.battery.batteries), 'battery.batteries should be an array');
    assert.equal(osd.battery.batteries.length, 2, 'Should have 2 battery cells');

    for (const cell of osd.battery.batteries) {
      assert.equal(typeof cell.capacity_percent, 'number');
      assert.equal(typeof cell.voltage, 'number');
      assert.equal(typeof cell.temperature, 'number');
      assert.equal(typeof cell.current, 'number');
      assert.equal(typeof cell.index, 'number');
      assert.equal(typeof cell.type, 'number');
      assert.equal(typeof cell.firmware_version, 'string');
    }

    // position_state nested structure
    assert.equal(typeof osd.position_state.gps_number, 'number');
    assert.equal(typeof osd.position_state.is_fixed, 'number');
    assert.equal(typeof osd.position_state.rtk_number, 'number');
    assert.equal(typeof osd.position_state.quality, 'number');

    // storage nested structure
    assert.equal(typeof osd.storage.total, 'number');
    assert.equal(typeof osd.storage.used, 'number');

    // obstacle_avoidance nested structure
    assert.equal(typeof osd.obstacle_avoidance.horizon, 'number');
    assert.equal(typeof osd.obstacle_avoidance.upside, 'number');
    assert.equal(typeof osd.obstacle_avoidance.downside, 'number');

    // maintain_status nested structure
    assert.ok(Array.isArray(osd.maintain_status.maintain_status_array), 'maintain_status_array should be an array');
    assert.equal(osd.maintain_status.maintain_status_array.length, 1);
    const maint = osd.maintain_status.maintain_status_array[0];
    assert.equal(typeof maint.state, 'number');
    assert.equal(typeof maint.last_maintain_type, 'number');
    assert.equal(typeof maint.last_maintain_time, 'number');
    assert.equal(typeof maint.last_maintain_flight_time, 'number');

    // Count total leaf fields to verify >= 30
    // 18 top-level numbers + 3 battery top + 7*2 battery cells + 4 position_state
    // + 2 storage + 3 obstacle_avoidance + 4 maintain_status = 18+3+14+4+2+3+4 = 48
    let leafCount = 0;
    leafCount += topLevelNumbers.length;                  // 18
    leafCount += 3;                                        // battery top-level numbers
    leafCount += osd.battery.batteries.length * 7;         // 14 battery cell fields
    leafCount += 4;                                        // position_state
    leafCount += 2;                                        // storage
    leafCount += 3;                                        // obstacle_avoidance
    leafCount += 4;                                        // maintain_status_array[0]
    assert.ok(leafCount >= 30, `Expected at least 30 leaf fields, counted ${leafCount}`);
  });
});
