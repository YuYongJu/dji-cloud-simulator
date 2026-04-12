# Domain Pitfalls

**Domain:** Open-source npm CLI tool launch (DJI Cloud API simulator)
**Researched:** 2026-04-12

## Critical Pitfalls

Mistakes that cause failed launches, broken first impressions, or security incidents.

### Pitfall 1: Publishing Without a `files` Whitelist Leaks Unintended Content

**What goes wrong:** Without a `files` field in package.json, npm publishes everything not in `.gitignore`. The current `.gitignore` only excludes `node_modules/` and `CLAUDE.md`. The `.planning/` directory, `package-lock.json`, and any future dotfiles (`.env`, config scratch files) would ship to npm. Worse: if an `.npmignore` is added later, it *replaces* `.gitignore` filtering entirely, so anything in `.gitignore` but not `.npmignore` leaks -- this has caused real credential exposures (e.g., `.envrc` with AWS keys).

**Why it happens:** Developers assume `.gitignore` controls what npm publishes. It does -- until `.npmignore` exists, at which point `.gitignore` is completely ignored by npm. Also, `package-lock.json` ships by default, which is unnecessary noise for CLI tools (it is for reproducible installs in apps, not published packages).

**Consequences:** Bloated package, leaked internal files, potential credential exposure. Users see `.planning/` and internal tooling in their `node_modules`, signaling amateur packaging.

**Prevention:** Use the `files` whitelist in package.json instead of `.npmignore`. Whitelist only what consumers need: `["simulator.mjs", "example-config.json", "README.md", "LICENSE"]`. Never create `.npmignore`. Run `npm pack --dry-run` before every publish to verify contents. Add a `prepublishOnly` script to automate this check.

**Detection:** `npm pack --dry-run` shows exactly what will be published. Add this as a CI step.

**Phase:** Must be addressed before first `npm publish`.

---

### Pitfall 2: Missing `author` and Metadata Signals an Unmaintained Package

**What goes wrong:** The current package.json has no `author`, no `homepage`, and no `bugs` URL. On npmjs.com, the package page will show blank author, no links to report issues, and no way to reach the maintainer. Developers evaluating whether to use the package see these as red flags.

**Why it happens:** `npm init` prompts for these but they're easy to skip. The package "works" without them.

**Consequences:** Reduced trust and adoption. The npm listing looks incomplete. Developers who hit issues have no path to report them.

**Prevention:** Add to package.json:
```json
{
  "author": "Panoptris",
  "homepage": "https://github.com/YuYongJu/dji-cloud-simulator#readme",
  "bugs": {
    "url": "https://github.com/YuYongJu/dji-cloud-simulator/issues"
  }
}
```

**Detection:** Visual inspection of the npm package page after publishing.

**Phase:** Pre-publish polish.

---

### Pitfall 3: The README Promises `npx` That Does Not Work Yet

**What goes wrong:** The README already says `npx dji-cloud-simulator` in every example. If someone discovers the repo before npm publish (it already has 3 stars), they try `npx`, it fails, and they leave. First impressions are permanent.

**Why it happens:** README was written aspirationally. The gap between "README says it works" and "it actually works" is the most dangerous period for an open-source project.

**Consequences:** Developers who try and fail during this window will not come back. A LinkedIn announcement amplifies this -- hundreds of people hitting a broken `npx` command simultaneously.

**Prevention:** npm publish must happen *before* any public announcement. Verify the full flow on a clean machine: `npx dji-cloud-simulator --help` should work without prior setup. If there is any delay between README being public and npm publish, add a note: "Install from source until npm publish is complete."

**Detection:** Run `npx dji-cloud-simulator` from a directory with no local clone after publishing.

**Phase:** Must be the first thing validated after npm publish, before any announcement.

---

### Pitfall 4: npm Token/Auth Misconfiguration Blocks Publishing

**What goes wrong:** As of December 2025, npm revoked all classic tokens. Session-based auth now expires after 2 hours. Granular write tokens max out at 90 days. First-time publishers who follow outdated tutorials will hit auth failures. CI publishing requires granular access tokens with the "Bypass 2FA" option explicitly enabled.

**Why it happens:** npm's auth model changed dramatically in late 2025. Most tutorials and blog posts predate these changes.

**Consequences:** Blocked publish. Wasted time debugging auth. If CI is set up with wrong token type, automated publishing silently fails.

**Prevention:** For manual first publish: use `npm login` (gives 2-hour session), then `npm publish` immediately. For CI: create a granular access token at npmjs.com/settings/~/tokens with publish scope limited to `dji-cloud-simulator`, enable "Bypass 2FA" for CI, and note the 90-day max expiry. Consider npm Trusted Publishing (OIDC) with GitHub Actions to avoid tokens entirely.

**Detection:** `npm whoami` confirms auth works. `npm publish --dry-run` confirms publish would succeed.

**Phase:** Must be resolved before first publish. CI token setup in the CI phase.

---

### Pitfall 5: Version 1.0.0 Commits to Stable API and Leaves No Safety Net

**What goes wrong:** Two issues compound here. First, shipping 1.0.0 with zero tests means any patch (1.0.1, 1.0.2) could break existing behavior with no way to detect it. Second, semver 1.0.0 signals "stable public API" -- if the MQTT message schema needs changes after user feedback, you are committed to a major version bump (2.0.0) to change it. Starting at `0.1.0` gives room to iterate on message format without breaking semver promises.

**Why it happens:** "It works on my machine" feels sufficient for a first release. 1.0.0 feels more "professional" than 0.x, but it carries real semver weight.

**Consequences:** A broken patch release after a successful launch destroys the trust built by the announcement. Or: users depend on message format details, and you cannot evolve without a major version bump that signals instability.

**Prevention:** Decide consciously: if the message schema is stable and spec-accurate, 1.0.0 is correct. If there is any uncertainty about message format, start at 0.1.0. Either way, write minimal contract tests before publishing -- does the MQTT message structure match the DJI spec? Do all four scenarios run without throwing? Add `"prepublishOnly": "npm test"` to package.json so broken publishes are blocked automatically.

**Detection:** CI runs tests on every push. `npm test` works locally. `prepublishOnly` blocks publish if tests fail.

**Phase:** Testing phase, before first publish. Version decision during pre-publish polish.

## Moderate Pitfalls

### Pitfall 6: Windows + ESM Shebang Edge Cases Break `npx` for Drone Developers

**What goes wrong:** The file is `.mjs` with `#!/usr/bin/env node`. npm creates `.cmd` shims on Windows that handle shebangs, but ESM `.mjs` files on Windows have had edge-case issues with older Node 18 minor versions. Drone/robotics developers skew heavily toward Windows.

**Why it happens:** CLI tools are typically tested on macOS/Linux by the author. Windows is an afterthought.

**Consequences:** The primary target audience (DJI Cloud API developers, many on Windows) hits `npx` failures. They file issues or silently leave.

**Prevention:** Test `npx dji-cloud-simulator` on Windows (or Windows in CI via `runs-on: windows-latest`) before announcement. Ensure Node 18.x LTS or newer is the tested baseline.

**Detection:** A Windows CI job catches this automatically.

**Phase:** CI setup phase (add Windows to the test matrix).

---

### Pitfall 7: No CHANGELOG Means Users Cannot Evaluate Upgrade Safety

**What goes wrong:** After 1.0.0, users need to know what changed in 1.0.1 before upgrading. Without a CHANGELOG, they must read git commits or guess.

**Prevention:** Create CHANGELOG.md following Keep a Changelog format. For the initial release it can be minimal: "Initial release" with a feature list. The habit matters more than the content of the first entry.

**Phase:** Pre-publish polish.

---

### Pitfall 8: GitHub Repo Missing Issue Templates Leads to Low-Quality Bug Reports

**What goes wrong:** First users who hit issues file vague reports like "it doesn't work." Without templates prompting for broker config, Node version, scenario used, and error output, debugging becomes a time sink.

**Prevention:** Add issue templates for bug reports and feature requests. Bug template should ask for: Node version, OS, MQTT broker, scenario, expected vs actual output, full error message.

**Detection:** First issue filed without enough information to reproduce.

**Phase:** Community setup phase (can be post-publish but before announcement).

---

### Pitfall 9: LinkedIn Announcement Without a Working Demo Flow

**What goes wrong:** LinkedIn audience is not going to clone a repo and set up an MQTT broker to try a tool. If the announcement does not show exactly what happens (terminal output, message examples), engagement drops. People like, scroll, and forget.

**Prevention:** Include a GIF or screenshot of terminal output in the README. The LinkedIn post should link to the repo but also show the value inline -- a code block of the MQTT messages, or a before/after of "testing with real drone" vs "testing with simulator."

**Detection:** Engagement metrics on the post. If click-through is low but impressions are high, the post did not convince people to visit.

**Phase:** Announcement preparation (after all code/publish work is done).

---

### Pitfall 10: Forgetting `npm pack` Dry Run Before First Publish

**What goes wrong:** `npm publish` is effectively irreversible after 24 hours (you can unpublish within 72 hours but the version number is burned forever). Publishing the wrong files, wrong version, or broken package on the first try means either living with it or burning the 1.0.0 version number.

**Prevention:** Always run `npm pack --dry-run` to inspect contents, then `npm publish --dry-run` to verify. Test the actual tarball: `npm pack`, then `npm install ./dji-cloud-simulator-1.0.0.tgz` in a temp directory and run the CLI. Automate with `"prepublishOnly": "npm test"` so at minimum tests must pass.

**Detection:** The dry run itself is the detection.

**Phase:** Immediately before publish.

## Minor Pitfalls

### Pitfall 11: No CI Badge in README Signals No Automated Quality

**What goes wrong:** Developers landing on the repo look for CI badges as a trust signal. No badge = "does this even have tests?"

**Prevention:** Add GitHub Actions CI, then add the badge to the top of README.

**Phase:** CI setup phase.

---

### Pitfall 12: `engines` Field Without Runtime Check Does Not Enforce Node Version

**What goes wrong:** package.json specifies `"node": ">=18"` but npm does not enforce this by default. Users on Node 16 install it, get cryptic ESM errors, and file issues.

**Prevention:** The `engines` field is advisory only. Document Node 18+ requirement prominently in README. The shebang `#!/usr/bin/env node` will use whatever `node` is on PATH, so there is no runtime guard either. Consider adding a version check at the top of `simulator.mjs` that prints a clear error on Node < 18.

**Phase:** Pre-publish polish (minor).

---

### Pitfall 13: Niche Tool Gets Zero Engagement Because Target Audience is Small

**What goes wrong:** DJI Cloud API developers are a small community. A perfectly polished launch gets 5 stars and no issues because the total addressable audience is limited.

**Prevention:** This is not a failure -- it is expected. Set realistic expectations: 20-50 stars from a LinkedIn announcement is a good outcome for a niche developer tool. The value is in the portfolio signal ("I build and open-source real tools"), not viral adoption.

**Detection:** If zero engagement after announcement, the packaging was fine -- the audience is just small.

**Phase:** Post-launch expectations management.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| npm publish | Auth failure from outdated token model (Pitfall 4) | Use `npm login` session for first publish, set up granular tokens for CI |
| npm publish | Shipping internal files (Pitfall 1) | Add `files` whitelist, run `npm pack --dry-run` |
| npm publish | Burning version number on broken package (Pitfall 10) | Test tarball locally before publish |
| npm publish | 1.0.0 commits to stable API prematurely (Pitfall 5) | Conscious version decision: 1.0.0 if schema is final, 0.1.0 if iterating |
| Testing | No tests means risky patches (Pitfall 5) | Minimal contract tests + `prepublishOnly` script before publish |
| CI setup | Token expiry breaks automated publish (Pitfall 4) | Use Trusted Publishing (OIDC) or calendar reminder for 90-day rotation |
| CI setup | Windows users hit ESM edge cases (Pitfall 6) | Add `windows-latest` to CI matrix |
| README/repo polish | Aspirational `npx` command fails (Pitfall 3) | Publish to npm before any public sharing |
| Announcement | Low engagement from niche audience (Pitfall 13) | Set realistic expectations, optimize for portfolio signal |
| Community | Vague bug reports (Pitfall 8) | Issue templates before announcement |

## Sources

- [npm: Publishing what you mean to publish](https://blog.npmjs.org/post/165769683050/publishing-what-you-mean-to-publish.html) - Official npm blog on files/ignore
- [For the love of god, don't use .npmignore](https://medium.com/@jdxcode/for-the-love-of-god-dont-use-npmignore-f93c08909d8d) - Why `files` whitelist beats `.npmignore`
- [npm classic tokens revoked (Dec 2025)](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/) - Token model changes
- [npm security update: granular token changes](https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/) - 90-day max expiry
- [GitHub README Template: 2026 Guide](https://dev.to/iris1031/github-readme-template-the-complete-2026-guide-to-get-more-stars-3ck2) - First impression factors
- [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/) - Required and recommended fields
- [Creating an NPM package that runs on command line](https://dev.to/nausaf/creating-an-npm-package-that-runs-on-command-line-with-npx-9a0) - CLI bin setup
