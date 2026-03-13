# DJI Cloud API Simulator

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
| **hms-alarm** | `npx dji-cloud-simulator --scenario hms-alarm` | Device comes online, fires 5 HMS alarm bursts (compass interference + battery imbalance), then goes offline. |
| **offline** | `npx dji-cloud-simulator --scenario offline` | Device comes online briefly, sends one OSD frame, then goes offline. Tests device lifecycle handling. |

## Options

```
--broker <url>      MQTT broker URL (default: mqtt://localhost:1883)
--gateway <sn>      Gateway (dock) serial number (default: DOCK-SN-001)
--device <sn>       Aircraft serial number (default: AIRCRAFT-SN-001)
--scenario <name>   Scenario to run (default: patrol)
```

The broker URL can also be set via the `MQTT_BROKER` environment variable.

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

The simulator also subscribes to `thing/product/{gatewaySn}/services` and auto-acknowledges any commands sent to the dock.

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

The simulator will auto-acknowledge with `result: 0` on the `services_reply` topic.

## License

MIT
