# Roadmap: DJI Cloud API Simulator — Open Source Launch

## Overview

This is a brownfield polish effort: the simulator already works. The roadmap sequences the scaffolding needed to earn developer trust — package metadata, tests, linting, CI, community files, and npm publish — followed by post-publish polish (badges, GIF, automated publish workflow). Every phase delivers a verifiable capability, and nothing publishes until the safety gates are in place.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Package Foundation** - Correct npm tarball contents and professional registry metadata
- [ ] **Phase 2: Test Suite** - Integration tests proving message format and scenario correctness
- [ ] **Phase 3: Linting** - ESLint 9 flat config with zero errors on simulator.mjs
- [ ] **Phase 4: CI Pipeline** - GitHub Actions running tests and lint on push/PR across Node matrix
- [ ] **Phase 5: Community Files** - CONTRIBUTING, CHANGELOG, issue templates, PR template
- [ ] **Phase 6: Pre-Publish Gate** - Safety scripts and tarball verification before first publish
- [ ] **Phase 7: npm Publish** - Package live on npm, npx works from a clean machine
- [ ] **Phase 8: Post-Publish Polish** - Automated publish workflow, badges, terminal GIF

## Phase Details

### Phase 1: Package Foundation
**Goal**: npm tarball contains only intended files and the npm registry page looks professional
**Depends on**: Nothing (first phase)
**Requirements**: PKG-01, PKG-02
**Success Criteria** (what must be TRUE):
  1. package.json `files` field whitelists only simulator.mjs, example-config.json, README.md, and LICENSE
  2. package.json `author`, `homepage`, `bugs`, and `repository` fields are populated with correct values
  3. `npm pack --dry-run` output contains no test files, .planning directory, or dotfiles
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 2: Test Suite
**Goal**: Developers can run `npm test` and verify the simulator produces spec-accurate MQTT messages
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-08
**Success Criteria** (what must be TRUE):
  1. `npm test` runs a test suite using node:test and Aedes in-memory broker with zero external dependencies
  2. Tests verify the offline scenario produces correct device-online, OSD, and device-offline message sequence
  3. Tests verify mission scenario lifecycle: status updates, progress events, and completion
  4. Tests verify OSD messages contain all 30+ required fields with correct types
  5. Tests verify command handling returns result:0 for known methods and result:314000 for unknown
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 3: Linting
**Goal**: Code quality is enforced by ESLint with zero errors on the existing codebase
**Depends on**: Phase 1
**Requirements**: LINT-01, LINT-02
**Success Criteria** (what must be TRUE):
  1. `npx eslint simulator.mjs` passes with zero errors using ESLint 9 flat config
  2. ESLint config exists as `eslint.config.mjs` with appropriate rules for Node.js ESM
  3. `npm run lint` script exists in package.json
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 4: CI Pipeline
**Goal**: Every push and PR is automatically tested across the supported Node.js version range including Windows
**Depends on**: Phase 2, Phase 3
**Requirements**: CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. Pushing to main triggers a GitHub Actions workflow that runs lint and tests
  2. Opening a PR triggers the same workflow
  3. CI matrix covers Node 18, 20, and 22
  4. CI matrix includes windows-latest alongside ubuntu-latest
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 5: Community Files
**Goal**: The repository has the community health files that signal a maintained, contributor-friendly project
**Depends on**: Phase 4
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04
**Success Criteria** (what must be TRUE):
  1. CONTRIBUTING.md exists with setup instructions, how to run tests, and PR guidelines
  2. CHANGELOG.md exists with the initial release entry
  3. `.github/ISSUE_TEMPLATE/` contains bug report and feature request templates
  4. `.github/PULL_REQUEST_TEMPLATE.md` exists with a checklist for contributors
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 6: Pre-Publish Gate
**Goal**: Safety mechanisms prevent publishing a broken or bloated package to npm
**Depends on**: Phase 2
**Requirements**: PKG-03, PKG-04
**Success Criteria** (what must be TRUE):
  1. `prepublishOnly` script in package.json runs `npm test` before any publish attempt
  2. `npm pack --dry-run` has been run and output verified to contain only intended files
  3. Running `npm publish --dry-run` succeeds without errors
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 7: npm Publish
**Goal**: The package is live on npm and any developer can use it immediately via npx
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: PUB-01, PUB-02, PUB-03
**Success Criteria** (what must be TRUE):
  1. `npm view dji-cloud-simulator` returns package metadata from the registry
  2. `npx dji-cloud-simulator --help` displays usage information on a clean machine
  3. `npx dji-cloud-simulator` connects to an MQTT broker and publishes messages
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

### Phase 8: Post-Publish Polish
**Goal**: The repository and README present a polished, badge-decorated first impression with automated future releases
**Depends on**: Phase 7
**Requirements**: CI-04, CI-05, READ-01, READ-02, READ-03, READ-04, READ-05
**Success Criteria** (what must be TRUE):
  1. GitHub Actions publish workflow triggers on Release creation and publishes to npm
  2. Publish workflow authenticates with npm using a granular access token
  3. README displays working npm version, CI status, and license badges
  4. README contains a terminal GIF or screenshot showing the simulator in action
  5. GitHub repo homepage URL points to the npm package page
**Plans**: 1 plan
Plans:
- [ ] 01-01-PLAN.md — Add files whitelist and registry metadata to package.json

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Package Foundation | 0/TBD | Not started | - |
| 2. Test Suite | 0/TBD | Not started | - |
| 3. Linting | 0/TBD | Not started | - |
| 4. CI Pipeline | 0/TBD | Not started | - |
| 5. Community Files | 0/TBD | Not started | - |
| 6. Pre-Publish Gate | 0/TBD | Not started | - |
| 7. npm Publish | 0/TBD | Not started | - |
| 8. Post-Publish Polish | 0/TBD | Not started | - |
