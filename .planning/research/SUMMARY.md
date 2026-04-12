# Project Research Summary

**Project:** dji-cloud-simulator
**Domain:** Open-source npm CLI tool polish and launch
**Researched:** 2026-04-12
**Confidence:** HIGH

## Executive Summary

This is not a greenfield build — the product already works. `simulator.mjs` is 684 lines, single-file, ships one dependency (`mqtt`), and already has a shebang. The task is wrapping a functional tool in the scaffolding that earns trust from the developer community: tests, CI, npm publish, and README polish. The research is unified on a "minimal footprint" philosophy: every addition must justify itself against the project's single-file identity.

The recommended approach is a strict critical-path sequence. Package.json metadata must be set first because it unblocks both npm publish and the CI badge chain. Tests come next because CI is meaningless without them. CI workflow is wired after tests pass locally. npm publish happens only after all of the above — and critically, before any public announcement. The terminal GIF for the LinkedIn launch is the highest-ROI post-publish polish item.

The dominant risk is shipping a broken first impression: the README already promises `npx dji-cloud-simulator` but the package is not on npm yet. Any developer who discovers the repo in this window and tries `npx` will leave permanently. The mitigation is sequencing: publish before announcing, verify on a clean machine, then share. Secondary risks are auth misconfiguration from npm's December 2025 token model changes and accidentally shipping internal files (`.planning/`, credentials) by omitting the `files` whitelist.

## Key Findings

### Recommended Stack

The stack additions are deliberately minimal: three dev dependencies total (ESLint 9 + `@eslint/js` + `globals`), with the test runner being `node:test` built into Node.js. No Vitest, no Jest, no Prettier. The rationale is that any framework adding 40MB of `node_modules` to a single-file project contradicts the project's identity. CI uses GitHub Actions with a Node 18/20/22 matrix, matching the declared `engines` field.

One meaningful disagreement exists between STACK.md and ARCHITECTURE.md on publish auth: STACK.md recommends OIDC Trusted Publishing as the CI auth mechanism; ARCHITECTURE.md recommends a classic granular access token because Trusted Publishing requires npm CLI 11.5.1+ and Node 22.14+, which conflicts with the Node 18 minimum. The architecture file's reasoning is more conservative and correct for a Node 18+ project — use granular tokens with a 90-day expiry, and set a calendar reminder. Revisit OIDC when the project drops Node 18 support.

**Core technologies:**
- `node:test` (built-in): test runner — zero dependencies, stable in Node 18+, sufficient for <20 integration tests
- `aedes` (dev dep): in-process MQTT broker for tests — eliminates Docker/external service dependency in CI, 2.5k+ stars, actively maintained
- ESLint 9 + flat config: linting — community-standard, flat config is default since v9, three dev deps total
- GitHub Actions: CI/CD — repo is already on GitHub, free for public repos, Node matrix validation is straightforward

### Expected Features

The research identifies a clear, sequenced critical path. Everything before npm publish is blocking; everything after is polish.

**Must have (table stakes):**
- `files` whitelist in package.json — without it, `.planning/`, test files, and future dotfiles ship to npm; allowlist is safer than `.npmignore`
- Basic test suite (5-10 tests, subprocess + Aedes) — unblocks meaningful CI; focuses on message envelope shape and scenario lifecycle, not internal implementation
- GitHub Actions CI (Node 18/20/22 matrix) — green badge signals maintained project; blocks CI status badge
- CONTRIBUTING.md (15-20 lines) — GitHub community health score; keep brief
- CHANGELOG.md (single 1.0.0 entry) — needed before publish; even one entry establishes the habit
- npm publish — the product goal; everything else enables or amplifies this
- Badges in README (npm version, CI status, license) — requires published package; immediate first-impression improvement

**Should have (differentiators):**
- Terminal GIF in README — highest-ROI LinkedIn launch asset; show `npx` running, not just static text
- GitHub issue templates (bug report + feature request) — structures first reports, signals mature governance
- PR template — small quality signal for contributors

**Defer (v2+):**
- TypeScript migration — adds build step complexity with zero user benefit for a CLI tool
- Automated release pipeline (semantic-release, changesets) — overkill until there is a regular release cadence
- Husky / lint-staged — ceremony for a single-file project with one contributor
- Documentation site — README is the documentation
- New simulator scenarios or features — explicitly out of scope

### Architecture Approach

The architecture is intentionally wrapper-only: `simulator.mjs` is not modified. All test infrastructure works by spawning the simulator as a child process and capturing its MQTT output through an in-process Aedes broker. This sidesteps the "simulator connects on module load" problem that would make import-based unit testing impossible without refactoring. The `offline` scenario is the test harness's primary target because it publishes a deterministic sequence of messages and self-terminates — no timeout management needed.

**Major components:**
1. `simulator.mjs` — product logic; not touched during this effort
2. `test/simulator.test.mjs` — integration tests; spawns simulator as child process, asserts on message structure via Aedes capture
3. `.github/workflows/ci.yml` — tests on push/PR; Node 18/20/22 matrix
4. `.github/workflows/publish.yml` — npm publish on GitHub Release; tests run before publish as safety gate
5. `package.json` (`files` field) — controls tarball contents; whitelist approach

### Critical Pitfalls

1. **Publishing without `files` whitelist leaks internal files** — Add `"files": ["simulator.mjs", "example-config.json"]` before first publish; run `npm pack --dry-run` to verify; the `.planning/` directory and potential future `.env` files ship by default without this
2. **README promises `npx` that does not work yet** — Publish to npm before any public announcement; verify on a clean machine; a broken `npx` at launch time permanently loses users who tried in that window
3. **npm auth misconfiguration from December 2025 token model changes** — Classic tokens were revoked; use `npm login` session for manual first publish (2-hour window); use granular access token with "Bypass 2FA" enabled for CI (90-day max expiry); set calendar reminder for rotation
4. **Version 1.0.0 with no tests means any patch could silently break behavior** — Add `"prepublishOnly": "npm test"` to block broken publishes; minimal contract tests validate message structure; decide consciously whether schema is stable enough for 1.0.0 vs starting at 0.1.0
5. **Windows ESM shebang edge cases break `npx` for the target audience** — Drone/robotics developers skew Windows; add `windows-latest` to CI matrix to catch issues before announcement

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Package Foundation
**Rationale:** All subsequent work depends on correct package.json metadata. The `files` field must exist before publish; `homepage`, `bugs`, and `author` should exist before the npm page goes live. This is a 30-minute task that unblocks everything.
**Delivers:** Correct npm tarball contents, professional npm registry listing, unblocked critical path
**Addresses:** Table stakes: `files` field, metadata fields
**Avoids:** Pitfall 1 (leaking internal files), Pitfall 2 (missing metadata signals unmaintained package)

### Phase 2: Test Suite
**Rationale:** Tests must exist before CI is meaningful. The architecture is determined: subprocess integration tests using `node:test` + `aedes`, targeting the `offline` scenario for deterministic message capture. Aedes is the only new dev dependency.
**Delivers:** `test/simulator.test.mjs` with 5-10 message structure and scenario lifecycle tests; `aedes` dev dependency; `"test": "node --test test/*.test.mjs"` script
**Uses:** `node:test`, `aedes`, subprocess integration testing pattern
**Implements:** Test harness component
**Avoids:** Pitfall 5 (no tests = risky patches), anti-pattern of mocking the MQTT client

### Phase 3: CI Pipeline
**Rationale:** CI depends on tests existing and passing locally. The workflow shape is fully determined by research: Node 18/20/22 matrix, ubuntu-latest plus windows-latest, lint + test steps.
**Delivers:** `.github/workflows/ci.yml`; green CI badge in README; validation across the `engines` range including Windows
**Uses:** GitHub Actions, `actions/setup-node@v4`
**Implements:** CI workflow component
**Avoids:** Pitfall 6 (Windows ESM shebang issues), Pitfall 11 (no CI badge signals no quality)

### Phase 4: Pre-Publish Polish
**Rationale:** Quick wins that improve the npm listing and repo health score before the package goes live. These are independent tasks that can be done in any order within the phase.
**Delivers:** CONTRIBUTING.md, CHANGELOG.md (1.0.0 entry), ESLint config + `prepublishOnly` script, explicit version decision (1.0.0 vs 0.1.0)
**Avoids:** Pitfall 5 (`prepublishOnly` blocks broken publishes), Pitfall 7 (no CHANGELOG)

### Phase 5: npm Publish
**Rationale:** Only execute after Phases 1-4 are complete and verified. This is the gating milestone. The sequence is: `npm pack --dry-run` to inspect tarball, test tarball locally in a temp directory, then `npm publish`.
**Delivers:** Package live on npm; `npx dji-cloud-simulator` works; npm version/downloads badges become functional
**Addresses:** Table stakes: functional `npx` command
**Avoids:** Pitfall 3 (aspirational `npx` in README), Pitfall 4 (auth misconfiguration), Pitfall 10 (burning version number on broken package)

### Phase 6: Publish Workflow and Post-Launch Polish
**Rationale:** Automated publish workflow can only be wired after the package exists on npm (first publish must be manual). Terminal GIF is highest-ROI LinkedIn asset; issue/PR templates reduce first-report noise.
**Delivers:** `.github/workflows/publish.yml` with granular token auth; badges in README (npm version, CI, license, node version); terminal GIF; GitHub issue templates; PR template
**Avoids:** Pitfall 8 (vague bug reports), Pitfall 9 (LinkedIn announcement without working demo)

### Phase Ordering Rationale

- Package metadata is foundational: it unblocks npm publish, which unblocks badges, which unblocks the GIF. Nothing else ships before this.
- Tests before CI: CI without tests is a green badge on nothing. The 30-minute test suite investment makes CI meaningful.
- Publish before announcement: the README already promises `npx` works. Every day the repo is public without a working `npx` is a reputational risk. There is no reason to delay publish after Phases 1-5 are complete.
- Post-launch polish after publish: terminal GIF should show `npx` working from the registry, not `node simulator.mjs`. Waiting until after publish means the GIF shows the real user experience.

### Research Flags

Phases with well-documented patterns (skip research-phase):
- **Phase 1 (Package Foundation):** Fully determined; exact field values known from research
- **Phase 2 (Test Suite):** Architecture fully specified; Aedes pattern, subprocess testing, 7 specific test cases identified
- **Phase 3 (CI Pipeline):** Workflow YAML determined; exact matrix specified
- **Phase 4 (Pre-Publish Polish):** All tasks are simple file creation
- **Phase 5 (npm Publish):** Sequence fully documented; auth approach determined

Phases that may benefit from a quick check:
- **Phase 6 (Post-Launch Polish):** Terminal GIF tooling (`vhs` vs `asciinema` vs `terminalizer`) may benefit from a quick evaluation of current macOS compatibility — this is minor and does not block any other phase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations backed by official docs (Node.js, npm, ESLint); no speculative choices |
| Features | HIGH | Critical path and anti-features are unambiguous; based on npm best practices and open-source conventions |
| Architecture | HIGH | Test architecture fully specified with concrete pattern; official Aedes and node:test docs cited |
| Pitfalls | HIGH | December 2025 npm auth changes are primary-sourced from GitHub changelog; `files` vs `.npmignore` is canonical npm guidance |

**Overall confidence:** HIGH

### Gaps to Address

- **OIDC vs granular token for CI publish:** STACK.md and ARCHITECTURE.md disagree. Architecture file's argument wins — granular token with 90-day expiry is the right choice for a Node 18+ project. Accept the rotation overhead or set a reminder. Revisit OIDC when Node 18 support is dropped.
- **Version number decision (1.0.0 vs 0.1.0):** Research flags this as a judgment call the owner must make. If message schema has any uncertainty, 0.1.0 preserves flexibility. This cannot be resolved by research.
- **Windows CI validation:** Research recommends `windows-latest` in the matrix but the project has not been tested on Windows. Validate in Phase 3 before announcement.

## Sources

### Primary (HIGH confidence)
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/) — OIDC publish auth
- [npm Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/) — supply chain security
- [npm classic tokens revoked Dec 2025](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/) — auth model change
- [Node.js test runner (v22 LTS docs)](https://nodejs.org/docs/latest-v22.x/api/test.html) — node:test stability
- [ESLint flat config](https://eslint.org/docs/latest/use/configure/configuration-files) — v9 flat config standard
- [npm `files` field](https://github.com/npm/cli/wiki/Files-&-Ignores) — whitelist vs blocklist
- [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) — field reference
- [Aedes MQTT broker](https://github.com/moscajs/aedes) — in-process test broker
- [GitHub Actions: Publishing Node.js packages](https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages) — CI publish workflow

### Secondary (MEDIUM confidence)
- [node:test vs Vitest vs Jest 2026 comparison](https://www.pkgpulse.com/blog/node-test-vs-vitest-vs-jest-native-test-runner-2026) — framework selection rationale
- [npm publish workflow patterns](https://httptoolkit.com/blog/automatic-npm-publish-gha/) — CI publish shape
- [GitHub README Template 2026](https://dev.to/iris1031/github-readme-template-the-complete-2026-guide-to-get-more-stars-3ck2) — first impression factors
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) — comprehensive checklist

### Tertiary (LOW confidence)
- Terminal GIF tool comparison (`vhs` vs `asciinema` vs `terminalizer`) — not deeply researched; verify macOS compatibility before committing to a tool

---
*Research completed: 2026-04-12*
*Ready for roadmap: yes*
