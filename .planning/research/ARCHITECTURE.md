# Architecture Patterns

**Domain:** Single-file npm CLI tool (MQTT simulator)
**Researched:** 2026-04-12

## Recommended Architecture

The project is and should remain a single-file CLI tool. Architecture here means: how CI/CD, testing, and publishing wrap around `simulator.mjs` without modifying it.

```
                          GitHub
                       ┌──────────────────────────┐
                       │  ci.yml                   │
  push / PR to main ──>│  checkout -> node 18      │
                       │  npm ci -> npm test        │
                       └──────────────────────────┘

                       ┌──────────────────────────┐
                       │  publish.yml              │
  GitHub Release    ──>│  checkout -> node 20      │
  (type: published)    │  npm ci -> npm test       │
                       │  npm publish              │
                       └──────────────────────────┘

  Test harness:
  ┌─────────────┐    spawn    ┌─────────────────┐
  │ node:test   │────────────>│ simulator.mjs   │
  │ test file   │             │ --scenario X     │
  │             │<──subscribe─│ --broker :PORT   │
  │ aedes       │  (captures  └─────────────────┘
  │ (in-memory) │   messages)
  └─────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `simulator.mjs` | All product logic. CLI parsing, MQTT publishing, scenario execution. Not touched by this effort. | MQTT broker (real or test) |
| `test/simulator.test.mjs` | Integration tests. Spawns simulator as child process, captures MQTT messages, asserts on structure. | Aedes broker (in-process), simulator (child process) |
| `.github/workflows/ci.yml` | Runs tests on every push/PR to main. | GitHub Actions, npm registry (read) |
| `.github/workflows/publish.yml` | Publishes to npm on GitHub Release. | GitHub Actions, npm registry (write) |
| `package.json` (`files` field) | Controls what ships to npm. Whitelist approach. | npm pack/publish |

### Data Flow

**Test flow:**
1. Test file starts an Aedes MQTT broker on a random available port
2. Test file subscribes a test client to `#` (all topics) on that broker
3. Test file spawns `node simulator.mjs --scenario offline --broker mqtt://localhost:{PORT}` as a child process
4. Simulator connects, publishes messages, exits (offline scenario self-terminates)
5. Test file collects all received messages, asserts on structure and topic names
6. Aedes broker tears down

**Publish flow:**
1. Developer bumps version in `package.json`, commits, pushes
2. Developer creates a GitHub Release (tag matches version)
3. `publish.yml` triggers, runs tests, then `npm publish`
4. Package available via `npx dji-cloud-simulator`

## Test Organization

### Use `node:test` -- No Additional Test Framework

**Why:** Zero dev dependencies for the test runner. The project's identity is minimal dependencies (single dep: `mqtt`). Adding Jest or Vitest for 3-4 test files contradicts that identity. `node:test` is stable since Node 18 (the project's minimum), includes assertions via `node:assert`, and runs with `node --test`.

**Confidence:** HIGH -- `node:test` is stable in Node 18+ per Node.js official docs.

### Use Aedes for In-Process MQTT Broker

**Why:** Testing a tool that publishes MQTT messages requires an actual broker to capture those messages. Aedes runs entirely in-process (no Docker, no external service), making tests fast and CI-friendly. It is the only dev dependency needed.

**Confidence:** HIGH -- Aedes is the standard in-process Node.js MQTT broker, 2.5k+ GitHub stars, actively maintained.

### Test File Structure

```
test/
  simulator.test.mjs    # All tests in one file (matches single-file product)
```

One test file. The product is one file; the tests should be one file. No test utilities directory, no fixtures folder, no shared helpers. If it grows past ~200 lines later, split then.

### What to Test

These tests protect the product's core value: **spec-accurate DJI Cloud API messages**.

| Test | What It Verifies | How |
|------|-----------------|-----|
| `--help exits cleanly` | CLI works, no crash | Spawn with `--help`, assert exit code 0, stdout contains "Usage" |
| `unknown scenario exits with error` | Error handling | Spawn with `--scenario bogus`, assert exit code 1 |
| `offline scenario publishes status online` | update_topo online message shape | Capture message on `sys/product/+/status`, assert `method === 'update_topo'`, `data.sub_devices` array present |
| `offline scenario publishes OSD` | Telemetry payload structure | Capture message on `thing/product/+/osd`, assert key fields: `latitude`, `longitude`, `height`, `battery.capacity_percent`, `position_state.rtk_number` |
| `offline scenario publishes status offline` | update_topo offline message shape | Capture second status message, assert `data.sub_devices` is empty array |
| `message envelope shape` | All messages have required DJI envelope fields | Assert `bid`, `tid`, `timestamp` present on event/status messages |
| `state message published` | Firmware state message | Capture on `thing/product/+/state`, assert `data.firmware_version` exists |

### What NOT to Test

| Skip | Reason |
|------|--------|
| Exact telemetry values (lat, battery %) | Randomized by design. Testing exact values creates brittle tests. |
| Timing between messages | Depends on `setTimeout`, flaky in CI. Test that messages arrive, not when. |
| MQTT library behavior | That is mqtt.js's job, not ours. |
| Battery decay curves | Internal math detail. If the formula changes, message structure tests still pass. |
| Reconnection behavior | Requires simulating broker drops. Complex, low ROI for a simulator tool. |

### Test Script in package.json

```json
{
  "scripts": {
    "test": "node --test test/*.test.mjs"
  }
}
```

No `--experimental` flags needed for Node 18+. The `--test` flag is stable.

## CI/CD Pipeline Structure

### Workflow 1: `ci.yml` -- Test on Push/PR

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
```

**Why matrix [18, 20, 22]:** The project declares `engines.node >= 18`. Testing all active LTS versions catches compatibility issues. Three versions is cheap (< 1 min each).

**Why no lint step:** The project is a single file with no linter configured. Adding ESLint for 684 lines of working code is overhead. If the community requests it later, add it then.

### Workflow 2: `publish.yml` -- Publish on Release

```yaml
name: Publish to npm
on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Trigger: GitHub Release, not tag push.** Releases are intentional human actions. Tag pushes can be accidental. The release event also gives you a place to write release notes.

**NPM_TOKEN (classic automation token), not OIDC trusted publishing.** Trusted publishing requires npm CLI 11.5.1+ and Node 22.14+. The project targets Node 18+. A classic automation token stored as a GitHub secret is simpler, works everywhere, and is appropriate for a project of this size. Re-evaluate when the project drops Node 18 support.

**Tests run before publish.** If tests fail, publish is skipped. This is the safety net.

### Version Management

Manual. Developer bumps version in `package.json` before creating a release. For a project this size, automated version bumping (semantic-release, changesets) is overhead. The publish workflow should not auto-bump -- the version in `package.json` is the source of truth.

Consider adding a duplicate-version check before `npm publish`:
```yaml
- name: Check version not already published
  run: |
    PKG_VERSION=$(node -p "require('./package.json').version")
    if npm view dji-cloud-simulator@$PKG_VERSION version 2>/dev/null; then
      echo "Version $PKG_VERSION already published"
      exit 1
    fi
```

## npm Package Contents

### Use `files` Field (Whitelist), Not `.npmignore` (Blocklist)

Add to `package.json`:
```json
{
  "files": [
    "simulator.mjs",
    "example-config.json"
  ]
}
```

**What ships:**
- `simulator.mjs` -- the product
- `example-config.json` -- documented config example
- `package.json` -- always included by npm
- `README.md` -- always included by npm
- `LICENSE` -- always included by npm

**What does NOT ship:** `.planning/`, `.github/`, `test/`, `package-lock.json`, `.gitignore`

**Why `files` over `.npmignore`:** Whitelist is safer. If you add a `.env` file or `secrets.json` later, it won't accidentally ship. The `files` field is self-documenting in `package.json`. Validate with `npm pack --dry-run` before any release.

**Confidence:** HIGH -- npm docs explicitly recommend `files` for strict control.

## Patterns to Follow

### Pattern 1: Subprocess Integration Testing
**What:** Test the CLI as users experience it -- spawn the actual process, capture real MQTT output.
**When:** Always. This is the primary (and only needed) test pattern for this tool.
**Why:** The simulator connects to MQTT on module load. You cannot `import` it in a test file without it executing. Subprocess testing sidesteps this and tests the real user experience.

### Pattern 2: Self-Terminating Test Scenarios
**What:** Use the `offline` scenario as the primary test harness because it publishes a known sequence of messages and exits on its own.
**When:** For all message structure tests.
**Why:** No need to manage timeouts, kill signals, or race conditions. The scenario has a deterministic start and end.

### Pattern 3: Random Port Allocation
**What:** Let Aedes bind to port 0 (OS-assigned random port), pass that port to the simulator via `--broker`.
**When:** Every test run.
**Why:** Avoids port conflicts in CI, allows parallel test execution.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Mocking the MQTT Client
**What:** Using `sinon` or `jest.mock()` to stub `mqtt.connect` and `client.publish`.
**Why bad:** Tests would verify your mocks work, not that the simulator produces correct MQTT messages. The value is in end-to-end message verification.
**Instead:** Use Aedes as a real in-memory broker. Capture actual published messages.

### Anti-Pattern 2: Testing Internals by Refactoring for Testability
**What:** Extracting functions from `simulator.mjs` into a separate module just so tests can import them.
**Why bad:** Violates the "no modularization" constraint. The product works as a single file; restructuring for test convenience adds complexity.
**Instead:** Test via subprocess. If a function's behavior matters, verify it through the messages it produces.

### Anti-Pattern 3: Automated Version Bumping
**What:** Using semantic-release, standard-version, or changesets to auto-bump versions.
**Why bad:** Adds 3-5 dev dependencies, complex config, and CI workflow changes for a project that will release a few times a year.
**Instead:** Manual version bump in `package.json`. Verify with the duplicate-version check in the publish workflow.

### Anti-Pattern 4: Docker-Based MQTT Testing in CI
**What:** Running `docker run eclipse-mosquitto` in GitHub Actions as a test broker.
**Why bad:** Adds Docker service dependency to CI, slower startup, more YAML complexity.
**Instead:** Aedes runs in-process. Zero infrastructure.

## Build Order Implications

The following order reflects real dependencies:

1. **Tests first** -- Write `test/simulator.test.mjs` with Aedes + `node:test`. Add `aedes` as devDependency, add `test` script. This must exist before CI makes sense.
2. **Package config** -- Add `files` field to `package.json`. Verify with `npm pack --dry-run`. This is independent of tests but should be validated before publishing.
3. **CI workflow** -- `ci.yml` depends on tests existing and passing. Create after tests work locally.
4. **Publish workflow** -- `publish.yml` depends on CI pattern being established. Create last. Requires `NPM_TOKEN` secret in GitHub repo settings.

## Scalability Considerations

| Concern | Now (v1.0) | If community grows | If scenarios multiply |
|---------|------------|--------------------|-----------------------|
| Test file size | One file, ~100 lines | Still one file up to ~300 lines | Split per scenario if > 4 scenario test suites |
| CI time | < 30s across 3 Node versions | Same | Same unless tests hit 2+ minutes |
| npm package size | ~25KB (simulator + example config) | Same | Grows only if new files added to `files` |
| Publish frequency | Manual, few times/year | Consider automated changelog | Same |

## Sources

- [npm docs: files field](https://docs.npmjs.com/cli/v8/configuring-npm/package-json/#files) -- HIGH confidence
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) -- HIGH confidence (used to decide against it for Node 18 compat)
- [Node.js test runner docs](https://nodejs.org/api/test.html) -- HIGH confidence
- [Aedes MQTT broker](https://github.com/moscajs/aedes) -- HIGH confidence
- [GitHub Actions: Publishing Node.js packages](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages) -- HIGH confidence
- [npm publish workflow patterns](https://httptoolkit.com/blog/automatic-npm-publish-gha/) -- MEDIUM confidence
- [node:test as Jest alternative in 2025](https://leapcell.io/blog/the-rise-of-node-js-node-test-a-jest-challenger-in-2025) -- MEDIUM confidence
