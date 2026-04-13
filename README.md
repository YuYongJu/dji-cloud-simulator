# DJI Cloud API Simulator

[![npm version](https://img.shields.io/npm/v/dji-cloud-simulator.svg)](https://www.npmjs.com/package/dji-cloud-simulator)
[![CI](https://github.com/YuYongJu/dji-cloud-simulator/actions/workflows/ci.yml/badge.svg)](https://github.com/YuYongJu/dji-cloud-simulator/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Spec-accurate MQTT simulator for the DJI Cloud API. Publishes realistic telemetry, HMS alarms, and mission progress events as if a Matrice 30T drone were connected via DJI Dock 2.

Built for integration testing, adapter development, and exploring the DJI Cloud API message format without real hardware.

## Quick Start

```bash
# 1. Start any MQTT broker
docker run -d -p 1883:1883 eclipse-mosquitto:2

# 2. Run the simulator
npx dji-cloud-simulator
```

That's it. The simulator connects to `mqtt://localhost:1883` and starts publishing DJI-format MQTT messages.

## Scenarios

| Scenario | Command | What it does |
|----------|---------|-------------|
| **patrol** (default) | `npx dji-cloud-simulator` | Continuous patrol loop. OSD every 2s, dock telemetry every 10s, HMS alarms every 40s. Runs until Ctrl+C. |
| **mission** | `npx dji-cloud-simulator --scenario mission` | Full mission lifecycle: takeoff, 4 waypoints, landing. Publishes `flighttask_progress` events with nested status/progress/ext. |
| **hms-alarm** | `npx dji-cloud-simulator --scenario hms-alarm` | Device comes online, fires 5 HMS alarm bursts with escalating cell imbalance. Early bursts show compass interference only; later bursts add battery imbalance when voltage differential exceeds 200mV threshold. |
| **offline** | `npx dji-cloud-simulator --scenario offline` | Device comes online briefly, sends one OSD frame, then goes offline. Tests device lifecycle handling. |

## Options

```
--broker <url>      MQTT broker URL (default: mqtt://localhost:1883)
--gateway <sn>      Gateway (dock) serial number (default: DOCK-SN-001)
--device <sn>       Aircraft serial number (default: AIRCRAFT-SN-001)
--scenario <name>   Scenario to run (default: patrol)
--config <path>     Load scenario config from JSON file
```

The broker URL can also be set via the `MQTT_BROKER` environment variable.

## Custom Configuration

Use `--config` to override default flight parameters. All fields are optional -- only include what you want to change:

```bash
npx dji-cloud-simulator --config my-site.json --scenario patrol
```

```json
{
  "waypoints": [
    { "lat": 37.7749, "lng": -122.4194 },
    { "lat": 37.7755, "lng": -122.4180 },
    { "lat": 37.7749, "lng": -122.4194 }
  ],
  "osd_interval_ms": 2000,
  "dock_osd_every_n": 5,
  "hms_alarm_every_n": 20,
  "battery_start": 95,
  "battery_decay_per_tick": 0.3,
  "battery_min": 20,
  "altitude_base": 80,
  "altitude_variation": 10,
  "hms_codes": [
    { "code": "0x16100001", "level": 1, "module": 1 },
    { "code": "0x16100086", "level": 2, "module": 1, "imminent": true }
  ]
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `waypoints` | Boston Seaport (8 pts) | Array of `{lat, lng}` for the flight path. Last point should match first for a loop. |
| `osd_interval_ms` | 2000 | Milliseconds between OSD telemetry publishes |
| `dock_osd_every_n` | 5 | Publish dock OSD every N OSD cycles |
| `hms_alarm_every_n` | 20 | Publish HMS alarm every N OSD cycles |
| `battery_start` | 95 | Starting battery percentage |
| `battery_decay_per_tick` | 0.3 | Battery % lost per OSD cycle |
| `battery_min` | 20 | Minimum battery (stops decaying) |
| `altitude_base` | 50 | Base flight altitude in meters |
| `altitude_variation` | 5 | Altitude oscillation amplitude in meters |
| `hms_codes` | compass + battery | Custom HMS alarm codes (overrides default behavior) |

See `example-config.json` for a complete template.

## MQTT Topics

The simulator publishes to the same topics as a real DJI Dock:

| Topic | QoS | Content |
|-------|-----|---------|
| `sys/product/{gatewaySn}/status` | 1 | Device online/offline via `update_topo` method |
| `thing/product/{deviceSn}/osd` | 0 | Aircraft telemetry at 0.5 Hz (30+ fields) |
| `thing/product/{gatewaySn}/osd` | 0 | Dock telemetry at 0.1 Hz |
| `thing/product/{deviceSn}/state` | 0 | Firmware version and state changes |
| `thing/product/{gatewaySn}/events` | 1 | HMS alarms, mission progress |
| `thing/product/{gatewaySn}/services_reply` | 1 | Auto-ack for inbound commands |

The simulator subscribes to `thing/product/{gatewaySn}/services` and responds to inbound commands. Known DJI methods (flighttask_*, device_reboot, cover_open/close, return_home, etc.) receive `result: 0` (success). Unknown methods receive `result: 314000` (unsupported). Commands missing `bid` or `method` fields are rejected.

## Message Format

All messages follow DJI Cloud API v1.x specification:

### Status (update_topo)

```json
{
  "bid": "sim-...",
  "tid": "tid-...",
  "timestamp": 1710000000000,
  "method": "update_topo",
  "data": {
    "domain": "0",
    "type": "60",
    "sub_type": "1",
    "sub_devices": [{
      "sn": "AIRCRAFT-SN-001",
      "domain": "0",
      "type": "60",
      "sub_type": "1",
      "index": "A"
    }]
  }
}
```

Device model codes: domain 0 = aircraft, type 60 = M30 series, sub_type 1 = M30T (thermal).

### OSD (Aircraft Telemetry)

30+ fields including: position, altitude, attitude, speed, wind, battery (dual cells with voltage/temperature/current), GPS/RTK state, home distance, storage, obstacle avoidance, flight time, maintenance status.

**Realistic telemetry behavior:**
- **Flight mode codes** transition through phases: 0 (standby) → 4 (auto takeoff) → 5 (wayline flight) → 9 (RTH) → 10 (landing)
- **Battery cells** diverge over time: cell 1 draws higher current, runs warmer, voltage differential grows from ~0mV to ~300mV over 8 minutes
- **RTK quality** correlates with satellite count: ≥8 SVs → quality 5 (RTK fixed), ≥6 → quality 4, ≥4 → quality 2 (float), <4 → quality 1 (single)
- **Storage** fills incrementally and caps at total capacity (64GB)

### HMS (Health Management System)

```json
{
  "method": "hms",
  "data": {
    "list": [{
      "code": "0x16100001",
      "level": 1,
      "module": 1,
      "in_the_sky": 1,
      "args": { "component_index": 0, "sensor_index": 0 }
    }]
  }
}
```

HMS levels: 0 = Notification, 1 = Reminder, 2 = Warning. Args use numeric indices per DJI spec.

**Battery imbalance correlation:** The battery cell imbalance alarm (`0x16100086`, level 2) only fires when the OSD telemetry shows a cell voltage differential exceeding 200mV. This matches real DJI behavior where HMS alarms are triggered by actual sensor thresholds, not arbitrary timers. In patrol mode, the differential grows naturally over flight time, so early HMS events contain only compass interference while later events include both alarms.

### Mission Progress (flighttask_progress)

```json
{
  "method": "flighttask_progress",
  "data": {
    "result": 0,
    "output": {
      "status": 5,
      "progress": { "current_step": 2, "percent": 35 },
      "ext": { "flight_id": "...", "track_id": "..." }
    }
  }
}
```

Status codes: 2 = preparing, 3 = takeoff, 5 = executing, 6 = finished.

## Using with Your Adapter

Subscribe to the topics above with any MQTT client. Example with `mosquitto_sub`:

```bash
# Watch all simulator messages
mosquitto_sub -t 'sys/product/#' -t 'thing/product/#' -v
```

To test command handling, publish to the services topic:

```bash
mosquitto_pub -t 'thing/product/DOCK-SN-001/services' \
  -m '{"bid":"test-001","tid":"tid-001","method":"flighttask_create","data":{}}'
```

Known methods get `result: 0`. Unknown methods get `result: 314000` (unsupported).

## Example Output

```
DJI Cloud API Simulator
  Broker     : mqtt://localhost:1883
  Gateway SN : DOCK-SN-001
  Device SN  : AIRCRAFT-SN-001
  Scenario   : patrol

Connected to broker

[status] Device ONLINE (update_topo)
[state]  Firmware 07.01.10.01
[osd]    lat=42.35210 lng=-71.04460 alt=50.0m bat=95% home=0m mode=0 rtk=5
[dock]   temp=23.1C humid=49% cover=closed
[osd]    lat=42.35210 lng=-71.04460 alt=50.5m bat=95% home=0m mode=4 rtk=5
[osd]    lat=42.35210 lng=-71.04460 alt=51.0m bat=94% home=0m mode=4 rtk=4
[osd]    lat=42.35290 lng=-71.04428 alt=52.5m bat=94% home=97m mode=5 rtk=5
[osd]    lat=42.35380 lng=-71.04396 alt=54.9m bat=93% home=215m mode=5 rtk=5
[dock]   temp=22.8C humid=51% cover=open
[osd]    lat=42.35470 lng=-71.04364 alt=53.1m bat=93% home=334m mode=5 rtk=4
...
[event]  HMS alarm: compass interference (Reminder) [battery delta 58mV, below 200mV threshold]
```

## Connection Resilience

The simulator automatically reconnects if the MQTT broker restarts or drops the connection. During a reconnect, the scenario continues from where it left off. This makes it safe to use in CI/CD pipelines and long-running test sessions.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, running tests, and PR guidelines.

## License

MIT
