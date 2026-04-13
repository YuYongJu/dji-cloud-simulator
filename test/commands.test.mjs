import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import mqtt from 'mqtt';
import { startBroker, spawnSimulator, collectMessages } from './helpers.mjs';

describe('command handling', () => {
  let brokerCtx;
  let testClient;
  let child;
  let replies = [];

  before(async () => {
    brokerCtx = await startBroker();

    testClient = mqtt.connect(brokerCtx.url, {
      clientId: 'test-cmd-client',
      clean: true,
    });

    await new Promise((resolve, reject) => {
      testClient.on('connect', resolve);
      testClient.on('error', reject);
    });

    // Subscribe to services_reply
    await new Promise((resolve) => {
      testClient.subscribe('thing/product/TEST-GW-001/services_reply', { qos: 1 }, resolve);
    });

    // Collect replies
    testClient.on('message', (_topic, payload) => {
      try {
        replies.push(JSON.parse(payload.toString()));
      } catch { /* ignore */ }
    });

    // Also collect status messages to know when simulator is ready
    const statusCollecting = collectMessages({
      brokerUrl: brokerCtx.url,
      topics: ['sys/product/TEST-GW-001/status'],
      until: (msgs) => msgs.length >= 1,
      timeoutMs: 10000,
    });

    child = spawnSimulator({
      brokerUrl: brokerCtx.url,
      scenario: 'offline',
    });

    child.stderr.on('data', (d) => process.stderr.write(d));

    // Wait for online status before sending commands
    await statusCollecting;

    // Send both commands in quick succession
    const knownCmd = JSON.stringify({
      bid: 'test-bid-001',
      tid: 'test-tid-001',
      method: 'flighttask_prepare',
      data: {},
    });
    testClient.publish('thing/product/TEST-GW-001/services', knownCmd, { qos: 1 });

    const unknownCmd = JSON.stringify({
      bid: 'test-bid-002',
      tid: 'test-tid-002',
      method: 'fake_nonexistent_method',
      data: {},
    });
    testClient.publish('thing/product/TEST-GW-001/services', unknownCmd, { qos: 1 });

    // Wait for replies
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (replies.length >= 2) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
  });

  after(async () => {
    if (testClient) await new Promise(r => testClient.end(true, r));
    if (child && !child.killed) child.kill();
    await new Promise(r => { if (child) child.on('exit', r); else r(); });
    if (brokerCtx) await brokerCtx.close();
  });

  it('known command method returns result 0', () => {
    const reply = replies.find(r => r.bid === 'test-bid-001');
    assert.ok(reply, 'Should receive reply for known command');
    assert.equal(reply.bid, 'test-bid-001');
    assert.equal(reply.method, 'flighttask_prepare');
    assert.equal(reply.data.result, 0, 'Known method should return result 0');
  });

  it('unknown command method returns result 314000', () => {
    const reply = replies.find(r => r.bid === 'test-bid-002');
    assert.ok(reply, 'Should receive reply for unknown command');
    assert.equal(reply.bid, 'test-bid-002');
    assert.equal(reply.method, 'fake_nonexistent_method');
    assert.equal(reply.data.result, 314000, 'Unknown method should return result 314000');
  });
});

describe('config file overrides', () => {
  let brokerCtx;
  let messages;
  let tmpConfigPath;

  before(async () => {
    brokerCtx = await startBroker();

    // Create temp config with custom battery_start and waypoints
    tmpConfigPath = join(tmpdir(), `dji-test-config-${Date.now()}.json`);
    writeFileSync(tmpConfigPath, JSON.stringify({
      battery_start: 80,
      waypoints: [
        { lat: 10.0, lng: 20.0 },
        { lat: 10.001, lng: 20.001 },
      ],
    }));

    const collecting = collectMessages({
      brokerUrl: brokerCtx.url,
      topics: ['thing/product/TEST-DEV-001/osd'],
      until: (msgs) => msgs.length >= 1,
      timeoutMs: 10000,
    });

    const child = spawnSimulator({
      brokerUrl: brokerCtx.url,
      scenario: 'offline',
      extraArgs: ['--config', tmpConfigPath],
    });

    child.stderr.on('data', (d) => process.stderr.write(d));

    messages = await collecting;

    await new Promise((resolve) => {
      child.on('exit', resolve);
      setTimeout(() => { child.kill(); resolve(); }, 5000);
    });
  });

  after(async () => {
    try { unlinkSync(tmpConfigPath); } catch { /* already cleaned */ }
    if (brokerCtx) await brokerCtx.close();
  });

  it('battery_start from config overrides default', () => {
    assert.ok(messages.length >= 1, 'Should receive at least 1 OSD message');
    const osd = messages[0].payload;
    // At tick=0, battery should be exactly battery_start (no decay yet)
    assert.equal(osd.battery.capacity_percent, 80, 'Battery should be 80 from config, not default 95');
  });

  it('waypoints from config override default position', () => {
    const osd = messages[0].payload;
    // latitude should be close to 10.0 (from config waypoints[0]), not default 42.3521
    assert.ok(
      Math.abs(osd.latitude - 10.0) < 0.01,
      `Latitude should be near 10.0 from config, got ${osd.latitude}`
    );
  });
});
