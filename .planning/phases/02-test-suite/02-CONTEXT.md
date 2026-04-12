# Phase 2: Test Suite - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

Integration test suite using node:test and Aedes in-memory MQTT broker. Tests verify offline scenario, mission scenario, OSD message format, HMS alarm threshold correlation, command handling, and config file overrides. npm test script works and all tests pass.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key research findings to follow:
- Use `node:test` (built-in) — zero test runner dependencies
- Use `aedes` as devDependency for in-memory MQTT broker
- Test by spawning simulator as child process, subscribing to topics, asserting on messages
- The `offline` scenario is the natural test harness — self-terminates after known sequence
- The `mission` scenario also self-terminates and should be tested
- Tests go in a `test/` directory
- Add `"test": "node --test test/"` script to package.json

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- simulator.mjs has 4 scenarios, all with deterministic message sequences
- offline scenario: online → OSD → offline (shortest, cleanest for testing)
- mission scenario: online → state → 7 progress events with OSD → offline
- HMS alarm scenario: 5 alarm bursts with escalating cell imbalance

### Established Patterns
- Pure ESM (type: module in package.json)
- Single dependency (mqtt)
- CLI args: --broker, --gateway, --device, --scenario, --config
- All messages are JSON on well-known MQTT topics

### Integration Points
- package.json needs `test` script and `aedes` devDependency
- test/ directory is new (not in files whitelist, won't ship to npm)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP success criteria.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
