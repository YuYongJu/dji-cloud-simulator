---
phase: 02-test-suite
plan: 02
subsystem: integration-tests
tags: [testing, integration, mqtt, mission, hms, commands, config]
dependency_graph:
  requires: [test-helpers, offline-test]
  provides: [mission-test, hms-test, command-test, config-test]
  affects: []
tech_stack:
  added: []
  patterns: [message-filtering, command-reply-pattern, temp-config-injection]
key_files:
  created:
    - test/mission.test.mjs
    - test/commands.test.mjs
  modified: []
decisions:
  - "Shared single offline simulator instance for both command tests to reduce test duration"
  - "Skipped assertion on HMS event index 2 (tick 150, ~180mV) due to noise making it borderline"
  - "Used collectMessages for online status detection before sending commands to avoid race conditions"
metrics:
  duration: ~3min
  completed: 2026-04-13
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 2 Plan 2: Mission, HMS, Commands, and Config Tests Summary

Integration tests covering mission flight lifecycle with 7-step progress validation, HMS alarm battery imbalance threshold correlation at 200mV, command response codes (result:0 known, result:314000 unknown), and config file override verification for battery_start and waypoints.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Mission lifecycle and HMS alarm threshold tests | 50ff1e0 | test/mission.test.mjs |
| 2 | Command handling and config override tests | 01527ce | test/commands.test.mjs |

## Implementation Details

### test/mission.test.mjs (187 lines)

Two test suites, 7 tests:

**mission scenario lifecycle (4 tests):**
1. Verifies 7 progress events with exact status sequence [2, 3, 5, 5, 5, 5, 6] and percent sequence [0, 5, 15, 35, 55, 80, 100]
2. Validates flight_id (starts with 'sim-flight-') and current_step (number) on all progress events
3. Confirms 21 OSD messages (7 steps x 3 per step)
4. Checks online status at start (1 sub_device) and offline at end (0 sub_devices)

**HMS alarm battery imbalance threshold (3 tests):**
1. Exactly 5 HMS alarm events received
2. All 5 contain base alarm code 0x16100001
3. Battery imbalance code 0x16100086 absent at ticks 50/100 (~60/120mV), present at ticks 200/250 (~240/300mV), with level 2 severity

### test/commands.test.mjs (172 lines)

Two test suites, 4 tests:

**command handling (2 tests):**
1. Known method (flighttask_prepare) returns bid echo, method echo, data.result === 0
2. Unknown method (fake_nonexistent_method) returns bid echo, method echo, data.result === 314000
- Both commands sent to same offline scenario instance for efficiency

**config file overrides (2 tests):**
1. battery_start:80 in temp config produces OSD with battery.capacity_percent === 80 (not default 95)
2. waypoints from config place latitude near 10.0 (not default 42.3521)
- Temp config written to os.tmpdir(), cleaned up in after()

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm test` exits with code 0: 13 tests pass across 5 suites (3 files)
- Mission test: ~50s (7 steps x 3 OSD x 2s sleep)
- HMS test: ~18s (500ms + 1000ms + 5 x 3000ms)
- Commands test: ~3.5s (offline scenario ~6s, commands sent during)
- Config test: ~6s (offline scenario with custom config)
- Total suite runtime: ~70s

## Known Stubs

None.
