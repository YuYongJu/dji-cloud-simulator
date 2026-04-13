import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startBroker, spawnSimulator, collectMessages } from './helpers.mjs';

describe('mission scenario lifecycle', () => {
  let brokerCtx;
  let messages;

  before(async () => {
    brokerCtx = await startBroker();

    const collecting = collectMessages({
      brokerUrl: brokerCtx.url,
      topics: [
        'sys/product/+/status',
        'thing/product/+/state',
        'thing/product/+/osd',
        'thing/product/+/events',
      ],
      until: (msgs) => {
        // Stop when we see the offline status (second status message with empty sub_devices)
        const statusMsgs = msgs.filter(m => m.topic.includes('/status'));
        if (statusMsgs.length >= 2) {
          const last = statusMsgs[statusMsgs.length - 1];
          return last.payload?.data?.sub_devices?.length === 0;
        }
        return false;
      },
      timeoutMs: 120000,
    });

    const child = spawnSimulator({
      brokerUrl: brokerCtx.url,
      scenario: 'mission',
    });

    child.stderr.on('data', (d) => process.stderr.write(d));

    messages = await collecting;

    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(() => { child.kill(); resolve(); }, 5000);
    });
  });

  after(async () => {
    if (brokerCtx) await brokerCtx.close();
  });

  it('produces 7 progress events with correct status and percent sequences', () => {
    const progressMsgs = messages.filter(
      m => m.topic.includes('/events') && m.payload?.method === 'flighttask_progress'
    );

    assert.equal(progressMsgs.length, 7, `Expected 7 progress events, got ${progressMsgs.length}`);

    const statuses = progressMsgs.map(m => m.payload.data.output.status);
    assert.deepEqual(statuses, [2, 3, 5, 5, 5, 5, 6], 'Status sequence mismatch');

    const percents = progressMsgs.map(m => m.payload.data.output.progress.percent);
    assert.deepEqual(percents, [0, 5, 15, 35, 55, 80, 100], 'Percent sequence mismatch');
  });

  it('progress events contain flight_id and current_step', () => {
    const progressMsgs = messages.filter(
      m => m.topic.includes('/events') && m.payload?.method === 'flighttask_progress'
    );

    for (const msg of progressMsgs) {
      const ext = msg.payload.data.output.ext;
      assert.equal(typeof ext.flight_id, 'string', 'flight_id should be a string');
      assert.ok(ext.flight_id.startsWith('sim-flight-'), `flight_id should start with 'sim-flight-', got ${ext.flight_id}`);

      const step = msg.payload.data.output.progress.current_step;
      assert.equal(typeof step, 'number', 'current_step should be a number');
    }
  });

  it('produces 21 OSD messages (7 steps x 3 per step)', () => {
    const osdMsgs = messages.filter(m => m.topic.includes('/osd'));
    assert.equal(osdMsgs.length, 21, `Expected 21 OSD messages, got ${osdMsgs.length}`);
  });

  it('has online status at start and offline status at end', () => {
    const statusMsgs = messages.filter(m => m.topic.includes('/status'));
    assert.equal(statusMsgs.length, 2, `Expected 2 status messages, got ${statusMsgs.length}`);

    // First: online with sub_devices
    assert.equal(statusMsgs[0].payload.data.sub_devices.length, 1, 'Online status should have 1 sub_device');

    // Last: offline with empty sub_devices
    assert.equal(statusMsgs[1].payload.data.sub_devices.length, 0, 'Offline status should have 0 sub_devices');
  });
});

describe('HMS alarm battery imbalance threshold', () => {
  let brokerCtx;
  let messages;

  before(async () => {
    brokerCtx = await startBroker();

    const collecting = collectMessages({
      brokerUrl: brokerCtx.url,
      topics: [
        'thing/product/+/events',
        'sys/product/+/status',
      ],
      until: (msgs) => {
        // Stop when offline status arrives
        const statusMsgs = msgs.filter(m => m.topic.includes('/status'));
        if (statusMsgs.length >= 2) {
          const last = statusMsgs[statusMsgs.length - 1];
          return last.payload?.data?.sub_devices?.length === 0;
        }
        return false;
      },
      timeoutMs: 30000,
    });

    const child = spawnSimulator({
      brokerUrl: brokerCtx.url,
      scenario: 'hms-alarm',
    });

    child.stderr.on('data', (d) => process.stderr.write(d));

    messages = await collecting;

    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(() => { child.kill(); resolve(); }, 5000);
    });
  });

  after(async () => {
    if (brokerCtx) await brokerCtx.close();
  });

  it('produces exactly 5 HMS alarm events', () => {
    const hmsMsgs = messages.filter(
      m => m.topic.includes('/events') && m.payload?.method === 'hms'
    );
    assert.equal(hmsMsgs.length, 5, `Expected 5 HMS events, got ${hmsMsgs.length}`);
  });

  it('all HMS events contain the base alarm code 0x16100001', () => {
    const hmsMsgs = messages.filter(
      m => m.topic.includes('/events') && m.payload?.method === 'hms'
    );

    for (const [i, msg] of hmsMsgs.entries()) {
      const codes = msg.payload.data.list.map(a => a.code);
      assert.ok(
        codes.includes('0x16100001'),
        `HMS event ${i} should contain base alarm 0x16100001, got codes: ${codes.join(', ')}`
      );
    }
  });

  it('battery imbalance code 0x16100086 absent in early events, present in late events', () => {
    const hmsMsgs = messages.filter(
      m => m.topic.includes('/events') && m.payload?.method === 'hms'
    );

    const hasBatteryAlarm = (msg) =>
      msg.payload.data.list.some(a => a.code === '0x16100086');

    // First 2 events (ticks 50, 100): base 60mV, 120mV -- below 200mV threshold
    assert.ok(!hasBatteryAlarm(hmsMsgs[0]), 'HMS event 0 (tick 50, ~60mV) should NOT have battery alarm');
    assert.ok(!hasBatteryAlarm(hmsMsgs[1]), 'HMS event 1 (tick 100, ~120mV) should NOT have battery alarm');

    // Index 2 (tick 150, ~180mV) is borderline due to noise -- skip assertion

    // Last 2 events (ticks 200, 250): base 240mV, 300mV -- above 200mV threshold
    assert.ok(hasBatteryAlarm(hmsMsgs[3]), 'HMS event 3 (tick 200, ~240mV) MUST have battery alarm 0x16100086');
    assert.ok(hasBatteryAlarm(hmsMsgs[4]), 'HMS event 4 (tick 250, ~300mV) MUST have battery alarm 0x16100086');

    // Verify the battery alarm has level 2
    const alarm3 = hmsMsgs[3].payload.data.list.find(a => a.code === '0x16100086');
    assert.equal(alarm3.level, 2, 'Battery imbalance alarm should have level 2');

    const alarm4 = hmsMsgs[4].payload.data.list.find(a => a.code === '0x16100086');
    assert.equal(alarm4.level, 2, 'Battery imbalance alarm should have level 2');
  });
});
