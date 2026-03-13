#!/usr/bin/env node

/**
 * DJI Cloud API Device Simulator
 *
 * Publishes spec-accurate DJI Cloud API v1.x MQTT messages, simulating
 * a Matrice 30T drone connected via DJI Dock 2.
 *
 * Topics published:
 *   sys/product/{gatewaySn}/status        - device online/offline (update_topo)
 *   thing/product/{deviceSn}/osd          - aircraft telemetry at 0.5 Hz
 *   thing/product/{gatewaySn}/osd         - dock telemetry at 0.1 Hz
 *   thing/product/{deviceSn}/state        - firmware/state changes
 *   thing/product/{gatewaySn}/events      - HMS alarms, mission progress
 *   thing/product/{gatewaySn}/services_reply - auto-ack for inbound commands
 */

import mqtt from 'mqtt';

// ── CLI ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
DJI Cloud API Device Simulator

Publishes spec-accurate MQTT messages simulating a DJI Matrice 30T
connected via DJI Dock 2. Use for integration testing, adapter
development, or exploring the DJI Cloud API message format.

Usage:
  dji-cloud-simulator [options]
  node simulator.mjs [options]

Options:
  --broker <url>      MQTT broker URL (default: mqtt://localhost:1883)
                      Also settable via MQTT_BROKER env var
  --gateway <sn>      Gateway (dock) serial number (default: DOCK-SN-001)
  --device <sn>       Aircraft serial number (default: AIRCRAFT-SN-001)
  --scenario <name>   Scenario to run (default: patrol)
  -h, --help          Show this help message

Scenarios:
  patrol              Continuous patrol loop with OSD, dock telemetry,
                      and periodic HMS alarms. Runs until Ctrl+C.
  mission             Full mission lifecycle: takeoff, waypoints, landing.
                      Publishes flighttask_progress events.
  hms-alarm           Device comes online, fires 5 HMS alarm bursts,
                      then goes offline.
  offline             Device comes online briefly, sends one OSD frame,
                      then goes offline.

Prerequisites:
  Any MQTT 3.1.1+ broker on localhost:1883. Quickest setup:
    docker run -d -p 1883:1883 eclipse-mosquitto:2

Examples:
  dji-cloud-simulator
  dji-cloud-simulator --scenario mission
  dji-cloud-simulator --broker mqtt://192.168.1.100:1883
  dji-cloud-simulator --gateway MY-DOCK-001 --device MY-DRONE-001

Message Format:
  All messages follow DJI Cloud API v1.x specification:
  - Status uses update_topo method with domain/type/sub_type/sub_devices
  - HMS levels: 0=Notification, 1=Reminder, 2=Warning
  - HMS args use numeric component_index/sensor_index
  - flighttask_progress uses nested { result, output: { status, progress, ext } }
  - All event messages include tid and bid envelope fields
  - OSD includes 30+ fields matching real Cloud API payloads
`);
  process.exit(0);
}

const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const BROKER_URL = getArg('--broker') ?? process.env.MQTT_BROKER ?? 'mqtt://localhost:1883';
const GATEWAY_SN = getArg('--gateway') ?? 'DOCK-SN-001';
const DEVICE_SN  = getArg('--device')  ?? 'AIRCRAFT-SN-001';
const SCENARIO   = getArg('--scenario') ?? 'patrol';

// ── Simulated flight path (Boston Seaport perimeter) ─────────────────

const WAYPOINTS = [
  { lat: 42.3521, lng: -71.0446 },
  { lat: 42.3535, lng: -71.0430 },
  { lat: 42.3548, lng: -71.0415 },
  { lat: 42.3555, lng: -71.0400 },
  { lat: 42.3540, lng: -71.0390 },
  { lat: 42.3525, lng: -71.0405 },
  { lat: 42.3510, lng: -71.0420 },
  { lat: 42.3521, lng: -71.0446 },
];

const HOME_POINT = WAYPOINTS[0];

// ── Helpers ──────────────────────────────────────────────────────────

const genBid = () => `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const genTid = () => `tid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => Date.now();

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function haversineMeters(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ── Client ───────────────────────────────────────────────────────────

console.log(`\nDJI Cloud API Simulator`);
console.log(`  Broker     : ${BROKER_URL}`);
console.log(`  Gateway SN : ${GATEWAY_SN}`);
console.log(`  Device SN  : ${DEVICE_SN}`);
console.log(`  Scenario   : ${SCENARIO}\n`);

const client = mqtt.connect(BROKER_URL, {
  clientId: `dji-sim-${Date.now()}`,
  clean: true,
});

client.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error(`\nCould not connect to MQTT broker at ${BROKER_URL}`);
    console.error(`\nQuick fix: docker run -d -p 1883:1883 eclipse-mosquitto:2\n`);
  } else {
    console.error('MQTT error:', err.message);
  }
  process.exit(1);
});

client.on('connect', () => {
  client.subscribe(`thing/product/${GATEWAY_SN}/services`, { qos: 1 });
});

client.on('message', (topic, payload) => {
  if (!topic.includes('/services')) return;
  try {
    const req = JSON.parse(payload.toString());
    console.log(`  <- Received command: ${req.method} (bid: ${req.bid})`);

    const reply = {
      bid: req.bid,
      tid: req.tid ?? genTid(),
      timestamp: now(),
      method: req.method,
      data: { result: 0 },
    };
    client.publish(
      `thing/product/${GATEWAY_SN}/services_reply`,
      JSON.stringify(reply),
      { qos: 1 },
    );
    console.log(`  -> Sent ack for ${req.method}`);
  } catch {
    // ignore malformed
  }
});

// ── Publish helpers ──────────────────────────────────────────────────

function publishStatus(online) {
  const payload = {
    bid: genBid(),
    tid: genTid(),
    timestamp: now(),
    method: 'update_topo',
    data: online
      ? {
          domain: '0',
          type: '60',
          sub_type: '1',
          device_secret: '',
          nonce: '',
          sub_devices: [{
            sn: DEVICE_SN,
            domain: '0',
            type: '60',
            sub_type: '1',
            index: 'A',
            device_secret: '',
            nonce: '',
          }],
        }
      : {
          domain: '3',
          type: '1',
          sub_type: '0',
          device_secret: '',
          nonce: '',
          sub_devices: [],
        },
  };

  client.publish(`sys/product/${GATEWAY_SN}/status`, JSON.stringify(payload), { qos: 1 });
  console.log(`[status] Device ${online ? 'ONLINE' : 'OFFLINE'} (update_topo)`);
}

function publishState() {
  const payload = {
    bid: genBid(),
    tid: genTid(),
    timestamp: now(),
    data: {
      firmware_version: '07.01.10.01',
      firmware_status: 0,
      sn: DEVICE_SN,
    },
  };
  client.publish(`thing/product/${DEVICE_SN}/state`, JSON.stringify(payload), { qos: 0 });
  console.log(`[state]  Firmware 07.01.10.01`);
}

function publishOsd(pos, tick) {
  const altitude   = 50 + Math.sin(tick * 0.1) * 5;
  const battery    = Math.max(20, 95 - tick * 0.3);
  const windSpeed  = 2 + Math.random() * 3;
  const hSpeed     = 8 + Math.random() * 4;
  const vSpeed     = (Math.random() - 0.5) * 0.5;
  const homeDistance = haversineMeters(pos, HOME_POINT);

  const payload = {
    latitude:         pos.lat,
    longitude:        pos.lng,
    height:           altitude,
    elevation:        altitude + 10,
    attitude_head:    (tick * 5) % 360,
    attitude_roll:    (Math.random() - 0.5) * 4,
    attitude_pitch:   (Math.random() - 0.5) * 4,
    horizontal_speed: hSpeed,
    vertical_speed:   vSpeed,
    wind_speed:       windSpeed,
    mode_code:        2,
    gear:             1,
    battery: {
      capacity_percent: Math.round(battery),
      landing_power:    Math.round(battery * 0.5),
      return_home_power: Math.round(battery * 0.3),
      batteries: [
        {
          capacity_percent: Math.round(battery),
          voltage:      22400 + Math.random() * 200,
          temperature:  250 + Math.random() * 30,
          current:      8000 + Math.random() * 1000,
          index:        0,
          type:         0,
          firmware_version: '02.01.07.16',
        },
        {
          capacity_percent: Math.round(battery - 1),
          voltage:      22350 + Math.random() * 200,
          temperature:  248 + Math.random() * 30,
          current:      8000 + Math.random() * 1000,
          index:        1,
          type:         0,
          firmware_version: '02.01.07.16',
        },
      ],
    },
    position_state: {
      gps_number:  14 + Math.floor(Math.random() * 6),
      is_fixed:    1,
      rtk_number:  6 + Math.floor(Math.random() * 6),
      quality:     5,
    },
    home_distance:     homeDistance,
    home_latitude:     HOME_POINT.lat,
    home_longitude:    HOME_POINT.lng,
    storage: {
      total:  64000,
      used:   Math.round(1200 + tick * 15),
    },
    obstacle_avoidance: {
      horizon:  1,
      upside:   1,
      downside: 1,
    },
    total_flight_time:  tick * 2,
    total_flight_distance: tick * hSpeed * 2,
    night_lights_state: 1,
    maintain_status: {
      maintain_status_array: [{
        state:  0,
        last_maintain_type:  1,
        last_maintain_time:  now() - 86400000,
        last_maintain_flight_time: 3600,
      }],
    },
  };

  client.publish(`thing/product/${DEVICE_SN}/osd`, JSON.stringify(payload), { qos: 0 });
  console.log(`[osd]    lat=${pos.lat.toFixed(5)} lng=${pos.lng.toFixed(5)} alt=${altitude.toFixed(1)}m bat=${Math.round(battery)}% home=${homeDistance.toFixed(0)}m`);
}

function publishDockOsd(tick) {
  const payload = {
    network_state: {
      type:     2,
      quality:  4,
    },
    drone_in_dock:      tick === 0 ? 1 : 0,
    drone_charge_state: {
      state:            tick === 0 ? 1 : 0,
      capacity_percent: tick === 0 ? 100 : 0,
    },
    environment_temperature: 22 + Math.random() * 3,
    temperature:        25 + Math.random() * 2,
    humidity:           45 + Math.random() * 10,
    rainfall:           0,
    wind_speed:         2 + Math.random() * 3,
    cover_state:        tick === 0 ? 0 : 1,
    putter_state:       0,
    supplement_light_state: 0,
    mode_code:          1,
    media_file_detail: {
      remain_upload: 0,
    },
  };

  client.publish(`thing/product/${GATEWAY_SN}/osd`, JSON.stringify(payload), { qos: 0 });
  console.log(`[dock]   temp=${payload.environment_temperature.toFixed(1)}C humid=${payload.humidity.toFixed(0)}% cover=${payload.cover_state ? 'open' : 'closed'}`);
}

function publishHmsAlarm() {
  const payload = {
    bid: genBid(),
    tid: genTid(),
    timestamp: now(),
    method: 'hms',
    data: {
      list: [
        {
          code: '0x16100001',
          level: 1,
          module: 1,
          in_the_sky: 1,
          device_type: 'aircraft',
          imminent: false,
          args: {
            component_index: 0,
            sensor_index: 0,
          },
        },
        {
          code: '0x16100086',
          level: 2,
          module: 1,
          in_the_sky: 1,
          device_type: 'aircraft',
          imminent: true,
          args: {
            component_index: 0,
            sensor_index: 1,
          },
        },
      ],
    },
  };

  client.publish(`thing/product/${GATEWAY_SN}/events`, JSON.stringify(payload), { qos: 1 });
  console.log(`[event]  HMS alarm: compass interference (Reminder) + battery cell imbalance (Warning)`);
}

function publishMissionProgress(step) {
  const steps = [
    { status: 2, current_step: 0,  percent: 0,   desc: 'Mission uploaded, preparing' },
    { status: 3, current_step: 0,  percent: 5,   desc: 'Takeoff initiated' },
    { status: 5, current_step: 1,  percent: 15,  desc: 'En route to waypoint 1' },
    { status: 5, current_step: 2,  percent: 35,  desc: 'Executing waypoint 2' },
    { status: 5, current_step: 3,  percent: 55,  desc: 'Executing waypoint 3' },
    { status: 5, current_step: 4,  percent: 80,  desc: 'Returning home' },
    { status: 6, current_step: 4,  percent: 100, desc: 'Mission complete, landed' },
  ];

  const s = steps[step % steps.length];
  const payload = {
    bid: genBid(),
    tid: genTid(),
    timestamp: now(),
    method: 'flighttask_progress',
    data: {
      result: 0,
      output: {
        status: s.status,
        progress: {
          current_step: s.current_step,
          percent: s.percent,
        },
        ext: {
          flight_id: 'sim-mission-001',
          current_waypoint_index: s.current_step,
          media_file_count: s.current_step > 0 ? s.current_step * 2 : 0,
          track_id: 'sim-track-001',
          flight_plan_id: 'sim-plan-001',
        },
      },
    },
  };

  client.publish(`thing/product/${GATEWAY_SN}/events`, JSON.stringify(payload), { qos: 1 });
  console.log(`[event]  Mission: ${s.desc} (status=${s.status}, ${s.percent}%)`);
}

// ── Scenarios ────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPatrol() {
  console.log('Starting patrol scenario: OSD at 2s intervals, dock OSD every 10s, looping waypoints\n');

  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(500);

  let tick = 0;
  let wpIdx = 0;
  let segT = 0;

  while (true) {
    const a = WAYPOINTS[wpIdx % WAYPOINTS.length];
    const b = WAYPOINTS[(wpIdx + 1) % WAYPOINTS.length];
    const pos = interpolate(a, b, segT);

    publishOsd(pos, tick);

    if (tick % 5 === 0) {
      publishDockOsd(tick);
    }

    if (tick > 0 && tick % 20 === 0) {
      await sleep(100);
      publishHmsAlarm();
    }

    segT += 0.2;
    if (segT >= 1) { segT = 0; wpIdx++; }
    tick++;

    await sleep(2000);
  }
}

async function runHmsAlarm() {
  console.log('HMS alarm scenario: device online, then immediate alarm burst\n');
  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(1000);

  for (let i = 0; i < 5; i++) {
    publishHmsAlarm();
    await sleep(3000);
  }

  publishStatus(false);
  console.log('\nScenario complete.');
  client.end();
}

async function runMission() {
  console.log('Mission scenario: device online, progress events, OSD during flight\n');
  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(1000);

  let tick = 0;
  for (let step = 0; step < 7; step++) {
    publishMissionProgress(step);
    for (let i = 0; i < 3; i++) {
      await sleep(2000);
      publishOsd(WAYPOINTS[tick % WAYPOINTS.length], tick++);
    }
  }

  publishStatus(false);
  console.log('\nMission complete.');
  client.end();
}

async function runOffline() {
  console.log('Offline scenario: device online briefly then goes offline\n');
  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(2000);
  publishOsd(WAYPOINTS[0], 0);
  await sleep(3000);
  publishStatus(false);
  console.log('\nDevice offline.');
  client.end();
}

// ── Main ─────────────────────────────────────────────────────────────

const SCENARIOS = { patrol: runPatrol, 'hms-alarm': runHmsAlarm, mission: runMission, offline: runOffline };

if (!SCENARIOS[SCENARIO]) {
  console.error(`Unknown scenario: ${SCENARIO}`);
  console.error(`Available: ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}

client.on('connect', async () => {
  console.log(`Connected to broker\n`);
  await SCENARIOS[SCENARIO]();
});

process.on('SIGINT', () => {
  console.log('\nStopping simulator...');
  publishStatus(false);
  setTimeout(() => { client.end(); process.exit(0); }, 500);
});
