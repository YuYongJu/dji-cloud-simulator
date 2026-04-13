---
phase: 02-test-suite
plan: 01
subsystem: test-infrastructure
tags: [testing, integration, mqtt, aedes, node-test-runner]
dependency_graph:
  requires: []
  provides: [test-helpers, offline-test, npm-test-script]
  affects: [package.json]
tech_stack:
  added: [aedes@1.0.2, node:test]
  patterns: [in-memory-mqtt-broker, child-process-spawn, message-collector]
key_files:
  created:
    - test/helpers.mjs
    - test/offline.test.mjs
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Used { Aedes } named import with createBroker() for aedes v1.x API (default export removed in v1.0)"
  - "Used glob pattern 'test/**/*.test.mjs' in test script since node --test requires explicit glob on Node 22"
metrics:
  duration: ~5min
  completed: 2026-04-12
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 2 Plan 1: Test Infrastructure and Offline Scenario Summary

Test harness with in-memory aedes broker, child process spawning, and message collection utilities; offline scenario integration tests validating 4-message sequence order and 48 OSD leaf fields with correct types.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install aedes, add test script, create test helper module | cf6e883 | package.json, test/helpers.mjs |
| 2 | Write offline scenario integration test with OSD field validation | cf6e883 | test/offline.test.mjs |

## Implementation Details

### test/helpers.mjs

Three reusable utilities:

- **startBroker()** - Creates aedes broker via `Aedes.createBroker()`, listens on random port (port 0), returns `{ broker, server, port, url, close() }`.
- **spawnSimulator({ brokerUrl, scenario, gateway, device, extraArgs })** - Spawns `node simulator.mjs` as child process with captured stdout/stderr.
- **collectMessages({ brokerUrl, topics, until, timeoutMs })** - MQTT client that subscribes to topic patterns, collects JSON-parsed messages, stops when `until` predicate returns true or timeout (default 15s).

### test/offline.test.mjs

Two integration tests:

1. **"offline scenario produces correct message sequence"** - Verifies exactly 4 messages arrive in order: status(online with 1 sub_device) -> state(firmware 07.01.10.01) -> OSD(with latitude) -> status(offline with 0 sub_devices).

2. **"OSD message contains all 30+ required fields with correct types"** - Validates all 23 top-level keys (18 numbers + 5 objects) and nested structures: battery (3 top-level + 7 fields per cell x 2), position_state (4), storage (2), obstacle_avoidance (3), maintain_status (4). Total verified leaf fields: 48.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] aedes v1.x API migration**
- **Found during:** Task 1 verification
- **Issue:** aedes v1.0.2 removed the default export constructor. `new Aedes()` and `Aedes()` both throw with migration instructions.
- **Fix:** Used named import `{ Aedes }` with `await Aedes.createBroker()` async factory.
- **Files modified:** test/helpers.mjs

**2. [Rule 3 - Blocking] node --test glob pattern required on Node 22**
- **Found during:** Task 1 verification
- **Issue:** `node --test test/` treats `test/` as a module path, not a directory to scan. Node 22 requires explicit glob.
- **Fix:** Changed test script to `node --test 'test/**/*.test.mjs'`.
- **Files modified:** package.json

## Verification Results

- `npm test` exits with code 0, 2/2 tests pass
- `npm pack --dry-run` confirms test/ excluded from package (5 files, files whitelist)
- Test output shows both "offline scenario" suite name and individual test names

## Known Stubs

None.
