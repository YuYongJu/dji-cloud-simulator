# Technology Stack

**Project:** dji-cloud-simulator (open-source npm CLI tool polish/launch)
**Researched:** 2026-04-12

## Context

This is NOT a greenfield build. The tool is 684 lines, single file (`simulator.mjs`), one runtime dependency (`mqtt`). We are adding polish tooling for open-source launch: testing, linting, CI, and npm publishing. Every choice below is optimized for minimal footprint on a small, focused CLI tool.

## Recommended Stack

### Runtime (no changes needed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | >=18 (target 22 LTS) | Runtime | Already specified in `engines`. Node 22 LTS (currently 22.22.x) is the sweet spot -- stable, maintained until April 2027, and has mature `node:test` support. No reason to bump the floor above 18 since the code uses nothing Node 18 can't handle. |
| mqtt.js | ^5.15.0 | MQTT client | Already the sole dependency. Current, well-maintained, ESM-compatible. No change needed. |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| node:test | built-in | Test runner | Zero dependencies. Ships with Node 18+. For a single-file CLI tool with ~15-20 unit tests, adding Vitest or Jest is overkill. `node --test` runs tests, `describe`/`it`/`beforeEach` all work. Snapshot testing available in Node 22.3+. The project constraint is "keep it simple" -- native test runner honors that. |
| node:assert | built-in | Assertions | Pairs with `node:test`. `assert.strictEqual`, `assert.deepStrictEqual`, `assert.throws` cover everything needed. No external assertion library required. |

**Confidence: HIGH** -- Node.js official docs confirm `node:test` is stable from Node 20+ and fully featured in Node 22 LTS. Multiple 2025-2026 sources recommend it for exactly this use case: small Node.js libraries and CLI tools.

**Note on Node 18:** `node:test` was experimental in Node 18 and became stable in Node 20. Tests will run fine on Node 18 but will emit experimental warnings to stderr. This is expected and harmless -- the API surface is identical. CI on Node 18 is still correct to validate runtime compatibility with the `engines` field.

**What NOT to use:**
- **Vitest**: Excellent framework, wrong tool. Vitest shines for Vite-based projects and large test suites. For a zero-build, single-file CLI, it adds ~40MB of `node_modules` for no benefit.
- **Jest**: Legacy choice. ESM support still requires configuration gymnastics. Heavier than Vitest with no advantage here.
- **c8/istanbul**: Skip code coverage tooling entirely. With 684 lines and <20 tests, coverage percentages are vanity metrics. If coverage is desired later, `node --test --experimental-test-coverage` works natively.

### Linting

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| ESLint | ^9.39.0 (v9 LTS) | Linting | ESLint 10 released Feb 2026 but v9 is still in LTS support. For a single-file project, stick with v9 -- it uses flat config (`eslint.config.js`), is battle-tested, and avoids any v10 migration surprises. Flat config is the default since v9. |
| @eslint/js | ^9.39.0 | Recommended rules | Provides the `recommended` ruleset. One import in `eslint.config.js`. |
| globals | ^16.0.0 | Environment globals | Provides correct Node.js global variable definitions (`process`, `console`, `Buffer`, `setTimeout`, etc.) for ESLint flat config. Avoids brittle manual global lists. |

**Confidence: HIGH** -- ESLint flat config is well-documented and the standard since v9.

**What NOT to use:**
- **Prettier**: Skip it. One file, one developer for now. Prettier adds config overhead and CI time for marginal benefit. If contributors later disagree on style, add it then.
- **ESLint 10**: Too fresh (Feb 2026). No compelling features for this project. v9 LTS is safer for launch.
- **Biome**: Promising but smaller ecosystem. ESLint is the standard community expectation for open-source JS projects.

### CI/CD

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A | CI pipeline | Repo is on GitHub. No reason to use anything else. Free for public repos. |
| actions/setup-node | v4 | Node setup | Standard action. Use with `node-version: [18, 20, 22]` matrix to test across supported engines. |
| npm trusted publishing | N/A | Secure npm publish | OIDC-based publishing from GitHub Actions. No long-lived npm tokens (classic tokens were revoked Dec 2025). This is now the ONLY secure way to publish from CI. |

**Confidence: HIGH** -- npm official docs, GitHub blog confirm trusted publishing is the standard path since late 2025.

### npm Publishing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `files` field in package.json | N/A | Control published files | Allowlist approach is the 2025+ best practice over `.npmignore`. Explicit is safer -- you declare what ships, everything else is excluded. For this project: `["simulator.mjs", "LICENSE", "README.md"]`. |
| `npm pack --dry-run` | N/A | Pre-publish validation | Verify exactly what will be published before it goes live. Should be a CI step. |
| npm provenance | N/A | Supply chain security | Automatically generated when using trusted publishing from GitHub Actions. Adds a verified "built here" badge on npmjs.com. Zero extra config needed with trusted publishing. |

**Confidence: HIGH** -- npm official docs confirm provenance is automatic with trusted publishing.

### Supporting Tools (all dev dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| globals | ^16.0.0 | ESLint Node.js globals | Required by ESLint flat config to define Node.js environment globals properly. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Test runner | node:test (built-in) | Vitest | 40MB+ dependency for <20 tests on a single file. Overkill. |
| Test runner | node:test (built-in) | Jest | ESM config pain, heavier, declining mindshare in 2025+. |
| Linter | ESLint 9 | Biome | Smaller community adoption. OSS contributors expect ESLint. |
| Formatter | None (skip) | Prettier | One file, one contributor. Add later if needed. |
| Coverage | None (skip) | c8 | Vanity metric at this scale. Native `--experimental-test-coverage` exists if needed. |
| Publish control | `files` field | `.npmignore` | Allowlist > blocklist for security. `files` is the modern standard. |
| npm auth | Trusted publishing (OIDC) | npm access token | Classic tokens revoked Dec 2025. Granular tokens work but OIDC is more secure and recommended. |

## Package.json Additions

The following fields should be added to `package.json`:

```json
{
  "files": [
    "simulator.mjs",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "test": "node --test",
    "lint": "eslint .",
    "prepublishOnly": "npm run lint && npm test",
    "prepack": "npm run lint && npm test"
  }
}
```

## Installation

```bash
# Dev dependencies (the only additions to the project)
npm install -D eslint @eslint/js globals
```

That is it. Three dev dependencies total. The test runner is built into Node.js.

## ESLint Config

Minimal `eslint.config.js`:

```javascript
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
```

## CI Workflow Shape

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
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
      - run: npm run lint
      - run: npm test
```

```yaml
# .github/workflows/publish.yml (triggered on GitHub release)
name: Publish
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Required for trusted publishing / OIDC
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish --provenance --access public
```

Note: First publish MUST be done manually from the terminal (`npm publish --access public`) because trusted publishing requires an existing package on npm. Subsequent publishes use the CI workflow.

## Sources

- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/)
- [npm Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/)
- [npm classic tokens revoked Dec 2025](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)
- [Node.js test runner (v22 LTS docs)](https://nodejs.org/docs/latest-v22.x/api/test.html)
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint v10.2.0 released April 2026](https://eslint.org/blog/2026/04/eslint-v10.2.0-released/)
- [npm `files` field best practice](https://github.com/npm/cli/wiki/Files-&-Ignores)
- [node:test vs Vitest vs Jest 2026 comparison](https://www.pkgpulse.com/blog/node-test-vs-vitest-vs-jest-native-test-runner-2026)
