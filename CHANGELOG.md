# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-12

### Added

- Spec-accurate DJI Cloud API v1.x MQTT message publishing
- 4 scenarios: patrol, mission, hms-alarm, offline
- Realistic telemetry: battery cell divergence, RTK quality correlation, flight mode transitions
- CLI with `--broker`, `--gateway`, `--device`, `--scenario`, `--config` options
- Custom config file support for waypoints, intervals, HMS codes
- Command handling: subscribes to services topic, auto-acks known DJI methods
- Connection resilience with auto-reconnect
- Integration test suite (13 tests) using `node:test` and Aedes
- ESLint 9 flat config
- GitHub Actions CI with Node 18/20/22 + Windows matrix
- `files` whitelist for clean npm tarball

[1.0.0]: https://github.com/YuYongJu/dji-cloud-simulator/releases/tag/v1.0.0
