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
import { readFileSync } from 'fs';

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
  --config <path>     Load scenario config from JSON file (see below)
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

Config File (--config):
  JSON file to override defaults. All fields optional:
  {
    "waypoints": [{"lat": 37.7749, "lng": -122.4194}, ...],
    "osd_interval_ms": 2000,
    "dock_osd_every_n": 5,
    "hms_alarm_every_n": 20,
    "battery_start": 95,
    "battery_decay_per_tick": 0.3,
    "battery_min": 20,
    "altitude_base": 50,
    "altitude_variation": 5,
    "hms_codes": [
      {"code": "0x16100001", "level": 1, "module": 1}
    ]
  }

Prerequisites:
  Any MQTT 3.1.1+ broker on localhost:1883. Quickest setup:
    docker run -d -p 1883:1883 eclipse-mosquitto:2

Examples:
  dji-cloud-simulator
  dji-cloud-simulator --scenario mission
  dji-cloud-simulator --broker mqtt://192.168.1.100:1883
  dji-cloud-simulator --config my-site.json --scenario patrol
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

// ── Config file loading ─────────────────────────────────────────────

let userConfig = {};
const configPath = getArg('--config');
if (configPath) {
  try {
    userConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    console.log(`Loaded config from ${configPath}`);
  } catch (err) {
    console.error(`Failed to load config from ${configPath}: ${err.message}`);
    process.exit(1);
  }
}

const BROKER_URL = getArg('--broker') ?? process.env.MQTT_BROKER ?? 'mqtt://localhost:1883';
const GATEWAY_SN = getArg('--gateway') ?? 'DOCK-SN-001';
const DEVICE_SN  = getArg('--device')  ?? 'AIRCRAFT-SN-001';
const SCENARIO   = getArg('--scenario') ?? 'patrol';

// ── Configurable defaults ───────────────────────────────────────────

const DEFAULT_WAYPOINTS = [
  { lat: 42.3521, lng: -71.0446 },
  { lat: 42.3535, lng: -71.0430 },
  { lat: 42.3548, lng: -71.0415 },
  { lat: 42.3555, lng: -71.0400 },
  { lat: 42.3540, lng: -71.0390 },
  { lat: 42.3525, lng: -71.0405 },
  { lat: 42.3510, lng: -71.0420 },
  { lat: 42.3521, lng: -71.0446 },
];

const WAYPOINTS          = (Array.isArray(userConfig.waypoints) && userConfig.waypoints.length >= 2)
                             ? userConfig.waypoints : DEFAULT_WAYPOINTS;
const OSD_INTERVAL_MS    = userConfig.osd_interval_ms ?? 2000;
const DOCK_OSD_EVERY_N   = userConfig.dock_osd_every_n ?? 5;
const HMS_ALARM_EVERY_N  = userConfig.hms_alarm_every_n ?? 20;
const BATTERY_START      = userConfig.battery_start ?? 95;
const BATTERY_DECAY      = userConfig.battery_decay_per_tick ?? 0.3;
const BATTERY_MIN        = userConfig.battery_min ?? 20;
const ALTITUDE_BASE      = userConfig.altitude_base ?? 50;
const ALTITUDE_VARIATION = userConfig.altitude_variation ?? 5;
const CUSTOM_HMS_CODES   = userConfig.hms_codes ?? null;

const HOME_POINT = WAYPOINTS[0];

// ── Flight mode codes (DJI Cloud API v1.x) ──────────────────────────
// 0=Standby, 4=Auto Takeoff, 5=Wayline Flight, 9=RTH, 10=Landing
const MODE = { STANDBY: 0, TAKEOFF: 4, WAYLINE: 5, RTH: 9, LANDING: 10 };

// ── Per-run unique IDs ──────────────────────────────────────────────
const RUN_ID = Date.now().toString(36);
const MISSION_FLIGHT_ID = `sim-flight-${RUN_ID}`;
const MISSION_TRACK_ID  = `sim-track-${RUN_ID}`;
const MISSION_PLAN_ID   = `sim-plan-${RUN_ID}`;

// ── Helpers ──────────────────────────────────────────────────────────

const genBid = () => `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const genTid = () => `tid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => Date.now();

/** RTK quality degrades when satellite count drops below acquisition threshold */
function rtkQuality(rtkNumber) {
  if (rtkNumber >= 8) return 5;  // RTK fixed (high precision)
  if (rtkNumber >= 6) return 4;  // RTK fixed
  if (rtkNumber >= 4) return 2;  // RTK float
  return 1;                       // Single point
}

/** Cell voltage differential grows with flight time, simulating thermal imbalance */
function cellDifferential(tick) {
  // Starts near 0mV, grows to ~300mV over 250 cycles (~8 min)
  const base = Math.min(300, tick * 1.2);
  return base + (Math.random() - 0.5) * 20;
}

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
console.log(`  Scenario   : ${SCENARIO}`);
if (configPath) {
  console.log(`  Config     : ${configPath}`);
  console.log(`  Waypoints  : ${WAYPOINTS.length} points (${WAYPOINTS[0].lat.toFixed(4)}, ${WAYPOINTS[0].lng.toFixed(4)} ...)`);
  console.log(`  OSD rate   : ${OSD_INTERVAL_MS}ms | Battery: ${BATTERY_START}% → ${BATTERY_MIN}% @ ${BATTERY_DECAY}/tick`);
}
console.log();

const client = mqtt.connect(BROKER_URL, {
  clientId: `dji-sim-${Date.now()}`,
  clean: true,
  reconnectPeriod: 3000,   // retry every 3s on disconnect
  connectTimeout: 10000,   // 10s connection timeout
});

let connected = false;

client.on('error', (err) => {
  if (err.code === 'ECONNREFUSED' && !connected) {
    console.error(`\nCould not connect to MQTT broker at ${BROKER_URL}`);
    console.error(`Retrying every 3 seconds... (Ctrl+C to stop)`);
    console.error(`\nQuick fix: docker run -d -p 1883:1883 eclipse-mosquitto:2\n`);
  } else if (connected) {
    console.error(`MQTT error: ${err.message} (will reconnect)`);
  }
});

client.on('offline', () => {
  if (connected) {
    connected = false;
    console.log('\n[conn]   Broker disconnected, attempting reconnect...');
  }
});

client.on('reconnect', () => {
  if (!connected) console.log('[conn]   Reconnecting...');
});

client.on('connect', () => {
  connected = true;
  client.subscribe(`thing/product/${GATEWAY_SN}/services`, { qos: 1 });
});

// Known DJI Cloud API service methods
const KNOWN_METHODS = new Set([
  'flighttask_prepare', 'flighttask_execute', 'flighttask_undo',
  'flighttask_pause', 'flighttask_recovery',
  'device_reboot', 'drone_open', 'drone_close',
  'device_format', 'cover_open', 'cover_close',
  'putter_open', 'putter_close', 'charge_open', 'charge_close',
  'sdr_workmode_switch', 'supplement_light_open', 'supplement_light_close',
  'return_home', 'live_start_push', 'live_stop_push',
]);

client.on('message', (topic, payload) => {
  if (!topic.includes('/services')) return;

  let req;
  try {
    req = JSON.parse(payload.toString());
  } catch {
    console.log(`  <- Malformed JSON command (ignored)`);
    return;
  }

  if (!req.bid || !req.method) {
    console.log(`  <- Invalid command: missing bid or method (ignored)`);
    return;
  }

  const known = KNOWN_METHODS.has(req.method);
  console.log(`  <- Received command: ${req.method} (bid: ${req.bid})${known ? '' : ' [unknown method]'}`);

  // Reply with result: 0 for known methods, result: 314000 (unsupported) for unknown
  const reply = {
    bid: req.bid,
    tid: req.tid ?? genTid(),
    timestamp: now(),
    method: req.method,
    data: { result: known ? 0 : 314000 },
  };
  client.publish(
    `thing/product/${GATEWAY_SN}/services_reply`,
    JSON.stringify(reply),
    { qos: 1 },
  );
  console.log(`  -> Sent ${known ? 'ack' : 'error 314000 (unsupported)'} for ${req.method}`);
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

function publishOsd(pos, tick, modeCode = MODE.WAYLINE) {
  const altitude   = ALTITUDE_BASE + Math.sin(tick * 0.1) * ALTITUDE_VARIATION;
  const battery    = Math.max(BATTERY_MIN, BATTERY_START - tick * BATTERY_DECAY);
  const windSpeed  = 2 + Math.random() * 3;
  const hSpeed     = 8 + Math.random() * 4;
  const vSpeed     = (Math.random() - 0.5) * 0.5;
  const homeDistance = haversineMeters(pos, HOME_POINT);

  // Realistic per-cell behavior: cell 1 draws slightly more current, gets warmer
  const cell0Current = 7500 + Math.random() * 1500;
  const cell1Current = 8000 + Math.random() * 1500; // higher draw
  const diff = cellDifferential(tick);
  const cell0Voltage = 22400 + Math.random() * 100;
  const cell1Voltage = cell0Voltage - diff; // grows apart over time

  const rtkNum = 6 + Math.floor(Math.random() * 6);

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
    mode_code:        modeCode,
    gear:             1,
    battery: {
      capacity_percent: Math.round(battery),
      landing_power:    Math.round(battery * 0.5),
      return_home_power: Math.round(battery * 0.3),
      batteries: [
        {
          capacity_percent: Math.round(battery),
          voltage:      Math.round(cell0Voltage),
          temperature:  250 + Math.random() * 30,
          current:      Math.round(cell0Current),
          index:        0,
          type:         0,
          firmware_version: '02.01.07.16',
        },
        {
          capacity_percent: Math.round(battery - 1),
          voltage:      Math.round(cell1Voltage),
          temperature:  252 + Math.random() * 30, // runs warmer from higher draw
          current:      Math.round(cell1Current),
          index:        1,
          type:         0,
          firmware_version: '02.01.07.16',
        },
      ],
    },
    position_state: {
      gps_number:  14 + Math.floor(Math.random() * 6),
      is_fixed:    1,
      rtk_number:  rtkNum,
      quality:     rtkQuality(rtkNum),
    },
    home_distance:     homeDistance,
    home_latitude:     HOME_POINT.lat,
    home_longitude:    HOME_POINT.lng,
    storage: {
      total:  64000,
      used:   Math.min(64000, Math.round(1200 + tick * 15)),
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
  console.log(`[osd]    lat=${pos.lat.toFixed(5)} lng=${pos.lng.toFixed(5)} alt=${altitude.toFixed(1)}m bat=${Math.round(battery)}% home=${homeDistance.toFixed(0)}m mode=${modeCode} rtk=${rtkQuality(rtkNum)}`);
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

function publishHmsAlarm(tick = 0) {
  const diff = cellDifferential(tick);
  const batteryImbalanced = diff > 200; // 200mV threshold triggers HMS

  // Use custom HMS codes if provided, otherwise default behavior
  let alarms;
  if (CUSTOM_HMS_CODES) {
    alarms = CUSTOM_HMS_CODES.map((c) => ({
      code: c.code,
      level: c.level ?? 1,
      module: c.module ?? 1,
      in_the_sky: 1,
      device_type: 'aircraft',
      imminent: c.imminent ?? false,
      args: c.args ?? { component_index: 0, sensor_index: 0 },
    }));
  } else {
    alarms = [
      {
        code: '0x16100001',
        level: 1,
        module: 1,
        in_the_sky: 1,
        device_type: 'aircraft',
        imminent: false,
        args: { component_index: 0, sensor_index: 0 },
      },
    ];

    // Battery imbalance alarm only fires when cell differential exceeds threshold
    if (batteryImbalanced) {
      alarms.push({
        code: '0x16100086',
        level: 2,
        module: 1,
        in_the_sky: 1,
        device_type: 'aircraft',
        imminent: diff > 250,
        args: { component_index: 0, sensor_index: 1 },
      });
    }
  }

  const payload = {
    bid: genBid(),
    tid: genTid(),
    timestamp: now(),
    method: 'hms',
    data: { list: alarms },
  };

  client.publish(`thing/product/${GATEWAY_SN}/events`, JSON.stringify(payload), { qos: 1 });
  const alarmDesc = batteryImbalanced
    ? `compass interference (Reminder) + battery cell imbalance (Warning, ${Math.round(diff)}mV delta)`
    : `compass interference (Reminder) [battery delta ${Math.round(diff)}mV, below 200mV threshold]`;
  console.log(`[event]  HMS alarm: ${alarmDesc}`);
}

// Mission steps with corresponding flight mode codes
const MISSION_STEPS = [
  { status: 2, current_step: 0,  percent: 0,   mode: MODE.STANDBY,  desc: 'Mission uploaded, preparing' },
  { status: 3, current_step: 0,  percent: 5,   mode: MODE.TAKEOFF,  desc: 'Takeoff initiated' },
  { status: 5, current_step: 1,  percent: 15,  mode: MODE.WAYLINE,  desc: 'En route to waypoint 1' },
  { status: 5, current_step: 2,  percent: 35,  mode: MODE.WAYLINE,  desc: 'Executing waypoint 2' },
  { status: 5, current_step: 3,  percent: 55,  mode: MODE.WAYLINE,  desc: 'Executing waypoint 3' },
  { status: 5, current_step: 4,  percent: 80,  mode: MODE.RTH,      desc: 'Returning home' },
  { status: 6, current_step: 4,  percent: 100, mode: MODE.LANDING,  desc: 'Mission complete, landing' },
];

function publishMissionProgress(step) {
  const s = MISSION_STEPS[step % MISSION_STEPS.length];
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
          flight_id: MISSION_FLIGHT_ID,
          current_waypoint_index: s.current_step,
          media_file_count: s.current_step > 0 ? s.current_step * 2 : 0,
          track_id: MISSION_TRACK_ID,
          flight_plan_id: MISSION_PLAN_ID,
        },
      },
    },
  };

  client.publish(`thing/product/${GATEWAY_SN}/events`, JSON.stringify(payload), { qos: 1 });
  console.log(`[event]  Mission: ${s.desc} (status=${s.status}, ${s.percent}%, mode=${s.mode})`);
}

// ── Scenarios ────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPatrol() {
  console.log(`Starting patrol scenario: OSD every ${OSD_INTERVAL_MS}ms, dock OSD every ${DOCK_OSD_EVERY_N} cycles, HMS every ${HMS_ALARM_EVERY_N} cycles\n`);

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

    // Mode transitions: standby → takeoff → wayline flight
    const mode = tick === 0 ? MODE.STANDBY : tick <= 2 ? MODE.TAKEOFF : MODE.WAYLINE;
    publishOsd(pos, tick, mode);

    if (tick % DOCK_OSD_EVERY_N === 0) {
      publishDockOsd(tick);
    }

    if (tick > 0 && tick % HMS_ALARM_EVERY_N === 0) {
      await sleep(100);
      publishHmsAlarm(tick);
    }

    segT += 0.2;
    if (segT >= 1) { segT = 0; wpIdx++; }
    tick++;

    await sleep(OSD_INTERVAL_MS);
  }
}

async function runHmsAlarm() {
  console.log('HMS alarm scenario: device online, then alarm bursts with escalating cell imbalance\n');
  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(1000);

  // Simulate progressive cell degradation: tick jumps simulate time passing
  // First few alarms below threshold, later ones trigger battery HMS
  const ticks = [50, 100, 150, 200, 250];
  for (const tick of ticks) {
    publishHmsAlarm(tick);
    await sleep(3000);
  }

  publishStatus(false);
  console.log('\nScenario complete.');
  client.end();
}

async function runMission() {
  console.log(`Mission scenario: flight=${MISSION_FLIGHT_ID}\n`);
  publishStatus(true);
  await sleep(500);
  publishState();
  await sleep(1000);

  let tick = 0;
  for (let step = 0; step < MISSION_STEPS.length; step++) {
    publishMissionProgress(step);
    const stepMode = MISSION_STEPS[step].mode;
    for (let i = 0; i < 3; i++) {
      await sleep(2000);
      publishOsd(WAYPOINTS[tick % WAYPOINTS.length], tick++, stepMode);
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

let scenarioStarted = false;
client.on('connect', async () => {
  if (!scenarioStarted) {
    scenarioStarted = true;
    console.log(`Connected to broker\n`);
    await SCENARIOS[SCENARIO]();
  } else {
    console.log('[conn]   Reconnected to broker');
  }
});

process.on('SIGINT', () => {
  console.log('\nStopping simulator...');
  publishStatus(false);
  setTimeout(() => { client.end(); process.exit(0); }, 500);
});
