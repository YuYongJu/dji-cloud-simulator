# Feature Landscape: Open-Source npm CLI Tool Launch Readiness

**Domain:** Open-source npm CLI tool polish and launch (DJI Cloud API MQTT simulator)
**Researched:** 2026-04-12

## Table Stakes

Features users expect. Missing = project looks unprofessional or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **npm publish works** (`npx dji-cloud-simulator`) | README promises it; currently aspirational. Non-functional `npx` command is the #1 credibility killer. | Low | Requires `files` field in package.json, npm account login, `npm publish`. Shebang (`#!/usr/bin/env node`) already present in simulator.mjs -- verified. Test with `npm pack --dry-run` before publishing. |
| **`files` field in package.json** | Controls what ships to npm. Without it, `.planning/`, test files, and other dev artifacts leak into the tarball. Prefer `files` allowlist over `.npmignore` blocklist -- easier to audit, less error-prone. | Low | Only need to list `simulator.mjs` and `example-config.json`. npm auto-includes `package.json`, `README.md`, `LICENSE`, and `CHANGELOG.md` regardless. Verify with `npm pack --dry-run` after setting. |
| **CI pipeline (GitHub Actions)** | Any serious open-source project has a green badge. Signals "this is maintained, not abandoned." Recruiters and engineers both check. | Low | Simple workflow: checkout, `npm ci`, `npm test`, run simulator for 5s and verify exit code. Single job, Node 18+20 matrix. |
| **Basic test suite** | Without tests, CI is meaningless and contributors can't verify they haven't broken anything. Doesn't need to be exhaustive -- just prove messages are spec-shaped. | Medium | Test message structure (required fields exist), scenario execution (starts, publishes, stops), config loading. Use Node's built-in `node:test` runner -- zero new dependencies. |
| **npm version badge** | First thing people look at on npm/GitHub. Signals "this is a real package." | Low | `![npm](https://img.shields.io/npm/v/dji-cloud-simulator)` |
| **CI status badge** | Second thing people look at. Green = trustworthy. | Low | GitHub Actions badge URL after CI is set up. |
| **License badge** | Quick signal that this is MIT and safe to use. | Low | `![license](https://img.shields.io/npm/l/dji-cloud-simulator)` |
| **`homepage` field in package.json** | npm registry page links to it. Without it, users can't find the repo from npm. | Low | Set to GitHub repo URL. |
| **`bugs` field in package.json** | npm registry shows "report a bug" link. Without it, frustrated users just leave instead of reporting. | Low | `"bugs": { "url": "https://github.com/YuYongJu/dji-cloud-simulator/issues" }` |
| **`author` field in package.json** | Shows who made this. Builds credibility on npm. | Low | Panoptris or personal name, with URL. |
| **CONTRIBUTING.md** | GitHub shows "Community" health score. Missing CONTRIBUTING = project looks closed to contributions. For a small tool, this can be brief (10-20 lines). | Low | Keep it simple: how to run locally, how to test, PR expectations. Don't over-engineer with CLA or complex processes. |
| **CHANGELOG.md** | Users need to know what changed between versions. Even v1.0.0 needs an initial entry. | Low | Single entry for 1.0.0 describing what's included. Use Keep a Changelog format. |

## Differentiators

Features that set this project apart. Not expected, but impressive for a LinkedIn announcement.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Terminal GIF/screenshot in README** | Immediately shows the tool working. A 10-second GIF of realistic MQTT telemetry streaming is more compelling than any paragraph of text. This is the single highest-ROI differentiator for LinkedIn virality. | Low | Use `vhs` (charmbracelet), `asciinema`, or `terminalizer` to record. Show `npx dji-cloud-simulator` outputting realistic drone telemetry. Place above the fold in README. |
| **GitHub issue templates** | Bug report and feature request templates in `.github/ISSUE_TEMPLATE/` signal mature project governance. Makes the repo look established. | Low | Two YAML templates: `bug_report.yml` and `feature_request.yml`. Keep them short. |
| **PR template** | `.github/pull_request_template.md` -- standardizes contributions. Small signal of quality. | Low | 5-10 lines: what changed, how to test, checklist. |
| **npm downloads badge** | Once published, shows adoption momentum. Even low numbers are fine for a niche tool -- the badge existing signals legitimacy. | Low | `![downloads](https://img.shields.io/npm/dm/dji-cloud-simulator)` |
| **Node version badge** | Shows compatibility at a glance. Useful for enterprise users evaluating the tool. | Low | `![node](https://img.shields.io/node/v/dji-cloud-simulator)` |
| **`description` in package.json** | Already present and good. Verify it renders well on npmjs.com. | Already done | Current description is solid. |
| **`keywords` in package.json** | Already present with good terms. | Already done | Current keywords cover the discovery space well. |
| **GitHub repository topics** | Already set per PROJECT.md context. | Already done | Confirmed present. |
| **Example output in README** | Show a sample JSON message so readers can see the spec accuracy without installing anything. A collapsed `<details>` block with a full OSD message. | Low | Already partially present with message format examples. Could add a real full output sample. |

## Anti-Features

Things to deliberately NOT build for this polish-only launch.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **CODE_OF_CONDUCT.md** | Overkill for a small utility with 3 stars and zero contributors. Adds bureaucratic weight without value. Revisit if community grows. | Skip entirely. CONTRIBUTING.md is sufficient. |
| **Extensive test coverage** | Diminishing returns. This is 684 lines of simulator logic, not a library with a public API surface. A handful of structural tests prove the tool works. Don't chase coverage percentages. | Write 5-10 tests covering message shape, scenario lifecycle, and config loading. No coverage badges or thresholds. |
| **TypeScript migration** | Single-file .mjs works. TypeScript adds build step complexity, tsconfig, compilation. Zero user benefit for a CLI tool. | Keep .mjs. If types matter later, add a `.d.ts` stub. |
| **Monorepo / workspace structure** | One file, one dependency. Any restructuring is complexity theater. | Keep flat structure. |
| **Automated release pipeline (semantic-release, changesets)** | Over-engineering for a v1.0 launch. Manual `npm version` + `npm publish` is fine until there's a release cadence that justifies automation. | Manual releases. Document the process in CONTRIBUTING.md. |
| **Husky / lint-staged / pre-commit hooks** | No linter configured, no formatter configured. Adding git hooks for a single-file project is pure ceremony. | Skip. Add if the project grows. |
| **Funding / sponsors setup** | No established user base. GitHub Sponsors or Open Collective adds noise before there's demand. | Skip. Revisit after adoption signals. |
| **Documentation site (Docusaurus, VitePress)** | README is the documentation. A separate site for a single-file CLI tool is absurd. | Keep everything in README. |
| **New scenarios or features** | Scope creep. The tool works. Ship what exists, measure interest, then invest. | Explicitly out of scope per PROJECT.md. |
| **Logo / branding assets** | Nice-to-have but time-consuming to do well. A bad logo is worse than no logo. | Skip unless one already exists or can be made quickly. |
| **Docker image** | Users can already run via npx. A Docker image adds maintenance burden for marginal convenience. | The README already shows `docker run` for the MQTT broker. That's sufficient. |

## Feature Dependencies

```
npm publish ──> files field in package.json (must be set BEFORE publishing)
npm publish ──> homepage + bugs fields (should be set before first publish, shows on npm page)
npm publish ──> author field (shows on npm page)
CI pipeline ──> test suite (CI needs something to run)
CI badge ──> CI pipeline (badge URL comes from Actions)
npm version badge ──> npm publish (badge pulls from registry)
npm downloads badge ──> npm publish (needs published package)
Terminal GIF ──> npm publish (should show npx working, not just node simulator.mjs)
CHANGELOG.md ──> version number finalized
```

## Priority Order (Critical Path)

```
1. package.json metadata (files, homepage, bugs, author)  -- unblocks everything
2. Test suite with node:test                               -- unblocks CI
3. CI pipeline (GitHub Actions)                            -- unblocks CI badge
4. CONTRIBUTING.md + CHANGELOG.md                          -- quick wins
5. npm publish                                             -- the whole point
6. Badges in README (npm version, CI, license)             -- post-publish
7. Terminal GIF in README                                  -- post-publish, highest visual impact
8. Issue templates + PR template                           -- nice polish
```

## MVP Recommendation

**Must ship (table stakes):**
1. Fix package.json metadata (`files`, `homepage`, `bugs`, `author`)
2. Basic test suite (5-10 tests, `node:test`, zero new deps)
3. GitHub Actions CI (Node 18+20 matrix, run tests)
4. CONTRIBUTING.md (brief, 15-20 lines)
5. CHANGELOG.md (single 1.0.0 entry)
6. `npm publish` -- the actual launch
7. Badges in README (npm version, CI status, license)

**Should ship (differentiators with high ROI):**
8. Terminal GIF in README -- single biggest LinkedIn impact item
9. GitHub issue templates (bug report + feature request)
10. PR template

**Defer everything else.** The anti-features list is the scope boundary.

## Sources

- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices) -- comprehensive checklist
- [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) -- field reference
- [Shields.io](https://shields.io/) -- badge generation
- [GitHub Community Health Files](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file) -- templates and standards
- [npm publish: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html) -- files field vs .npmignore
- [npm Files & Ignores wiki](https://github.com/npm/cli/wiki/Files-&-Ignores) -- what gets included by default
- [The GitHub README Template That Gets Stars](https://dev.to/belal_zahran/the-github-readme-template-that-gets-stars-used-by-top-repos-4hi7) -- README structure
