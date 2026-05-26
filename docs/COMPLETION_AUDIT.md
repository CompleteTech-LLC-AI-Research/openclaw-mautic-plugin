# Completion Audit

Last audited: 2026-05-26

Objective: make the `mautic-control` OpenClaw plugin production-ready for ClawHub deployment, preserving the local Docker stack behavior and identifying exact remaining blockers if public deployment is not possible.

## Result

The plugin package is production-ready for ClawHub package review from the public GitHub repository. Local stack behavior is preserved, production defaults are restrictive, and the direct GitHub-source ClawHub dry run passes.

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Status |
| --- | --- | --- |
| Audit package, manifest, runtime, docs, and stack | `docs/CLAWHUB_READINESS.md`, this audit, repeated `npm`/stack/OpenClaw checks | Complete |
| Publishable package metadata | `package.json` has scoped name, version, description, license, author, repository, bugs, homepage, keywords, files, OpenClaw compat/build metadata | Complete |
| Not private-only package posture | `package.json` has `"private": false` | Complete |
| Source metadata | `package.json.repository`, `package.json.homepage`, `package.json.bugs`; `npm run clawhub:dry-run` supplies source repo/ref/commit | Complete |
| License, changelog, security policy | `LICENSE`, `CHANGELOG.md`, `SECURITY.md` | Complete |
| Maintainer/support info | `package.json.author`, `SECURITY.md`, repository issue URL | Complete |
| Keep sensitive values out of package/docs | Secret scan found only variable names and safety docs, not actual token/password values | Complete |
| Threat model documented | `SECURITY.md` primary risks and mitigations | Complete |
| Dangerous capabilities opt-in by default | `openclaw.plugin.json` and `lib/runtime.js` default maintenance, automation, workspace read/write to false | Complete |
| Preserve local maintenance behavior | local stack bootstrap explicitly sets `allowMaintenanceCommands=true`, `allowAutomationJobCommands=false` | Complete |
| API path restriction | `assertMauticApiPath` in `lib/runtime.js`; covered by `test/runtime.test.js` | Complete |
| Workspace path guards | `safeWorkspacePath`, `assertPathWithinRoot`; covered by `test/runtime.test.js` | Complete |
| Workspace read/write/delete policy | `allowWorkspaceRead`, `allowWorkspaceWrite`; live smoke writes/reads a nested file | Complete |
| Console command allowlist | hardcoded command list plus capability toggles; covered by unit and live smoke tests | Complete |
| OpenClaw state no longer on Windows 9p for `/state` | stack uses `openclaw_state:/state`; live stat shows auth/session files mode `600` | Complete |
| Deep security audit no critical findings | `openclaw security audit --deep --json` reports `critical: 0` | Complete |
| Required environment/config docs | `README.md` documents Mautic credentials, console token, base URL, console URL, workspace roots, optional env fallbacks | Complete |
| Console bridge deployment/security docs | `README.md` and `SECURITY.md` document `mautic/console-bridge.php`, token, and private-network requirement | Complete |
| Tool behavior with/without console bridge | `README.md` states only `mautic_console` requires the bridge | Complete |
| Unit tests | `test/runtime.test.js`, run by `npm test` | Complete |
| Live smoke test script | `scripts/live-smoke.mjs`, run by `npm run live:smoke` | Complete |
| CI workflow | `.github/workflows/ci.yml` runs lint, tests, and package validation | Complete |
| ClawHub dry-run | `npm run clawhub:dry-run` passes from local folder with source metadata | Complete |
| Accidental publish guard | `npm run clawhub:publish` refuses private source unless `CLAWHUB_ALLOW_PRIVATE_SOURCE=1` is set after private-source review approval | Complete |
| Direct GitHub-source ClawHub dry-run | `clawhub package publish CompleteTech-LLC-AI-Research/openclaw-mautic-plugin --dry-run` passes from public `main` | Complete |
| Public source access | GitHub repo visibility is public and `npm run readiness:check` verifies ClawHub can fetch it | Complete |
| Repo clean and pushed | `git status --short --branch` reports `main...origin/main` after latest push | Complete |

## Latest Verification Commands

Run from `/mnt/c/users/timot/documents/projects/docker/mautic-plugin`:

```bash
npm run lint
npm test
npm run package:check
npm run live:smoke
npm run clawhub:dry-run
npm run readiness:check
```

Run from `/mnt/c/Users/timot/Documents/projects/docker/openclaw-mautic-stack`:

```bash
node scripts/audit.mjs
node scripts/audit.mjs --live
docker compose exec -T openclaw sh -lc 'openclaw security audit --deep --json'
```

## Remaining Warning

`openclaw security audit --deep --json` reports one warning:

`plugins.tools_reachable_permissive_policy`

This is documented and accepted for the trusted local single-operator stack. Mitigation for broader deployment is to use restrictive OpenClaw profiles or explicit tool allowlists for agents that process untrusted input.
