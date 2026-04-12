# Requirements: DJI Cloud API Simulator — Open Source Launch

**Defined:** 2026-04-12
**Core Value:** Developers can test DJI Cloud API integrations with realistic, spec-accurate MQTT messages without needing a physical drone or dock.

## v1 Requirements

Requirements for open-source launch readiness. Each maps to roadmap phases.

### Package Config

- [ ] **PKG-01**: package.json has `files` whitelist so only simulator.mjs, example-config.json, README, LICENSE ship to npm
- [ ] **PKG-02**: package.json has `author`, `homepage`, `bugs` fields populated
- [ ] **PKG-03**: package.json has `prepublishOnly` script that runs tests before any publish
- [ ] **PKG-04**: `npm pack --dry-run` shows only intended files, verified before publish

### Testing

- [ ] **TEST-01**: Integration test suite using `node:test` and Aedes in-memory MQTT broker
- [ ] **TEST-02**: Offline scenario test verifies device online → OSD → device offline message sequence
- [ ] **TEST-03**: Mission scenario test verifies full lifecycle: status, progress events, completion
- [ ] **TEST-04**: OSD message format test verifies all 30+ fields present with correct types
- [ ] **TEST-05**: HMS alarm test verifies battery imbalance threshold correlation (>200mV triggers alarm)
- [ ] **TEST-06**: Command handling test verifies known methods get result:0, unknown get result:314000
- [ ] **TEST-07**: Config file test verifies custom waypoints/intervals override defaults
- [ ] **TEST-08**: `npm test` script works and all tests pass

### CI/CD

- [ ] **CI-01**: GitHub Actions CI workflow runs tests on push to main and on PRs
- [ ] **CI-02**: CI tests across Node 18, 20, 22 matrix
- [ ] **CI-03**: CI includes `windows-latest` in OS matrix
- [ ] **CI-04**: Automated npm publish workflow triggers on GitHub Release creation
- [ ] **CI-05**: Publish workflow uses npm authentication (OIDC or granular token)

### Community Files

- [ ] **COMM-01**: CONTRIBUTING.md with setup instructions, how to run tests, PR guidelines
- [ ] **COMM-02**: CHANGELOG.md documenting v1.0.0 (or 0.1.0) release
- [ ] **COMM-03**: GitHub issue templates (bug report, feature request)
- [ ] **COMM-04**: GitHub PR template

### npm Publish

- [ ] **PUB-01**: Package published to npm as `dji-cloud-simulator`
- [ ] **PUB-02**: `npx dji-cloud-simulator --help` works from a clean machine
- [ ] **PUB-03**: `npx dji-cloud-simulator` connects to MQTT broker and publishes messages

### README & Presentation

- [ ] **READ-01**: README has npm version badge
- [ ] **READ-02**: README has CI status badge
- [ ] **READ-03**: README has license badge
- [ ] **READ-04**: Terminal GIF/screenshot showing simulator output in action
- [ ] **READ-05**: GitHub repo has homepage URL set to npm package page

### Linting

- [ ] **LINT-01**: ESLint 9 with flat config, no errors on `simulator.mjs`
- [ ] **LINT-02**: Lint runs as part of CI

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### New Scenarios

- **SCEN-01**: Multi-device simulation (multiple drones from one dock)
- **SCEN-02**: Emergency RTH / battery failsafe scenario
- **SCEN-03**: Media upload progress events

### Enhanced Simulation

- **SIM-01**: Programmatic API (import as library, not just CLI)
- **SIM-02**: Custom device models beyond M30T/Dock 2
- **SIM-03**: Configurable error injection for fault-tolerance testing

## Out of Scope

| Feature | Reason |
|---------|--------|
| TypeScript migration | Working JS, single file — TS adds build step for no user benefit |
| Documentation site | README is sufficient for a CLI tool of this size |
| CODE_OF_CONDUCT | Not needed at this community size |
| Coverage thresholds | Over-engineering for <20 tests |
| Modularization | 684 lines in one file is fine, no contributor confusion |
| Automated release pipeline (semantic-release) | Manual publish is safer for first launch |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKG-01 | Phase 1: Package Foundation | Pending |
| PKG-02 | Phase 1: Package Foundation | Pending |
| PKG-03 | Phase 6: Pre-Publish Gate | Pending |
| PKG-04 | Phase 6: Pre-Publish Gate | Pending |
| TEST-01 | Phase 2: Test Suite | Pending |
| TEST-02 | Phase 2: Test Suite | Pending |
| TEST-03 | Phase 2: Test Suite | Pending |
| TEST-04 | Phase 2: Test Suite | Pending |
| TEST-05 | Phase 2: Test Suite | Pending |
| TEST-06 | Phase 2: Test Suite | Pending |
| TEST-07 | Phase 2: Test Suite | Pending |
| TEST-08 | Phase 2: Test Suite | Pending |
| CI-01 | Phase 4: CI Pipeline | Pending |
| CI-02 | Phase 4: CI Pipeline | Pending |
| CI-03 | Phase 4: CI Pipeline | Pending |
| CI-04 | Phase 8: Post-Publish Polish | Pending |
| CI-05 | Phase 8: Post-Publish Polish | Pending |
| COMM-01 | Phase 5: Community Files | Pending |
| COMM-02 | Phase 5: Community Files | Pending |
| COMM-03 | Phase 5: Community Files | Pending |
| COMM-04 | Phase 5: Community Files | Pending |
| PUB-01 | Phase 7: npm Publish | Pending |
| PUB-02 | Phase 7: npm Publish | Pending |
| PUB-03 | Phase 7: npm Publish | Pending |
| READ-01 | Phase 8: Post-Publish Polish | Pending |
| READ-02 | Phase 8: Post-Publish Polish | Pending |
| READ-03 | Phase 8: Post-Publish Polish | Pending |
| READ-04 | Phase 8: Post-Publish Polish | Pending |
| READ-05 | Phase 8: Post-Publish Polish | Pending |
| LINT-01 | Phase 3: Linting | Pending |
| LINT-02 | Phase 3: Linting | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-04-12*
*Last updated: 2026-04-12 after roadmap creation*
