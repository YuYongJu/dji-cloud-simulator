# Contributing to DJI Cloud API Simulator

Thanks for your interest in contributing! This project is maintained by [Panoptris](https://panoptris.com).

## Getting Started

```bash
git clone https://github.com/YuYongJu/dji-cloud-simulator.git
cd dji-cloud-simulator
npm install
```

## Running the Simulator

You need an MQTT broker running locally:

```bash
docker run -d -p 1883:1883 eclipse-mosquitto:2
```

Then run any scenario:

```bash
node simulator.mjs
node simulator.mjs --scenario mission
node simulator.mjs --scenario hms-alarm
node simulator.mjs --scenario offline
```

## Running Tests

```bash
npm test
```

Tests use Node's built-in test runner (`node:test`) and an in-memory MQTT broker (`aedes`). No external broker needed.

## Linting

```bash
npm run lint
```

## Making Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes
4. Run tests (`npm test`) and lint (`npm run lint`)
5. Commit with a descriptive message
6. Push to your fork and open a pull request

## Pull Request Guidelines

- Keep PRs focused on a single change
- Ensure all tests pass
- Ensure lint passes with no errors
- Update README.md if you add new scenarios or options
- Add tests for new scenarios or message types

## Reporting Issues

Use [GitHub Issues](https://github.com/YuYongJu/dji-cloud-simulator/issues) to report bugs or request features.

For bug reports, include:
- Node.js version (`node --version`)
- MQTT broker details
- The scenario and options you used
- Expected vs actual behavior

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
