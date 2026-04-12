# DJI Cloud API Simulator — Open Source Launch

## What This Is

A spec-accurate MQTT simulator for the DJI Cloud API that publishes realistic telemetry, HMS alarms, and mission progress events as if a Matrice 30T drone were connected via DJI Dock 2. Built for integration testing and adapter development without real hardware. Open-sourced by Panoptris.

## Core Value

Developers can test DJI Cloud API integrations with realistic, spec-accurate MQTT messages without needing a physical drone or dock.

## Requirements

### Validated

- ✓ Publishes spec-accurate DJI Cloud API v1.x MQTT messages — existing
- ✓ 4 scenarios (patrol, mission, hms-alarm, offline) — existing
- ✓ Realistic telemetry with battery cell divergence, RTK correlation, flight modes — existing
- ✓ CLI with broker, gateway, device, scenario, config options — existing
- ✓ Custom config file support for waypoints, intervals, HMS codes — existing
- ✓ Command handling (subscribes to services, auto-acks known methods) — existing
- ✓ Connection resilience with auto-reconnect — existing
- ✓ MIT license under Panoptris — existing

### Active

- [ ] Published to npm so `npx dji-cloud-simulator` actually works
- [ ] Dependencies install correctly (`npm install` from fresh clone works)
- [ ] CI pipeline (GitHub Actions) runs tests on push/PR
- [ ] Basic test suite verifying message format and scenario execution
- [ ] CONTRIBUTING.md with contribution guidelines
- [ ] CHANGELOG.md tracking releases
- [ ] GitHub repo has issue templates and PR template
- [ ] README has CI badge, npm version badge
- [ ] `.npmignore` explicitly controls what ships to npm

### Out of Scope

- New scenarios or features — polish only, ship what exists
- Modularization / refactoring — single file works fine at 684 lines
- Multi-device simulation — future enhancement
- Media/video simulation — future enhancement
- LinkedIn post content — separate from code readiness

## Context

- Repo has 3 stars already despite not being formally announced
- Never published to npm — the `npx` command in README is aspirational
- Single file (`simulator.mjs`), single dependency (`mqtt`), 684 lines
- No tests, no CI, no open-source community files exist
- GitHub repo already has good description, topics, and MIT license
- Copyright is Panoptris, repo is under YuYongJu personal account
- Goal: make this presentable for a LinkedIn announcement

## Constraints

- **Scope**: Polish and publish only — no new features
- **Size**: Keep it simple — this is a small focused tool, don't over-engineer
- **Copyright**: Panoptris copyright in LICENSE stays as-is
- **npm**: Publish under `dji-cloud-simulator` (name available, user has npm account)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polish-only scope for v1.0 launch | Ship what works, validate interest before investing more | — Pending |
| Keep single-file architecture | 684 lines is manageable, don't modularize for its own sake | — Pending |
| Panoptris copyright on personal repo | User preference, company open-sourcing part of stack | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after initialization*
