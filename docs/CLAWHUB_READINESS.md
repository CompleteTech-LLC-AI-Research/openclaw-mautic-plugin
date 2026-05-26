# ClawHub Readiness

Last audited: 2026-05-26

## Status

The plugin package and local OpenClaw/Mautic stack are ready for ClawHub review, but public ClawHub deployment is blocked until the source repository is accessible to ClawHub.

Current repository:

- `CompleteTech-LLC-AI-Research/openclaw-mautic-plugin`
- Visibility: private
- Latest pushed branch: `main`

## Passing Checks

- `npm test`
- `npm run lint`
- `npm run package:check`
- `npm run live:smoke`
- `npm run readiness:check` fails only on the public-source review blocker while the repo remains private
- `node scripts/audit.mjs`
- `node scripts/audit.mjs --live`
- `openclaw plugins doctor`
- `openclaw security audit --deep --json`

The deep security audit currently reports:

- `critical`: 0
- `warn`: 1
- `info`: 1

The remaining warning is `plugins.tools_reachable_permissive_policy`. This is expected while the local stack enables `mautic-control` tools in the default context for a trusted single-operator environment. For broader deployment, use restrictive OpenClaw profiles or explicit tool allowlists for agents that handle untrusted input.

## ClawHub Dry Runs

Direct GitHub-source dry run:

```bash
npm exec --yes clawhub -- package publish CompleteTech-LLC-AI-Research/openclaw-mautic-plugin --dry-run
```

Result:

```text
GitHub repo not found: CompleteTech-LLC-AI-Research/openclaw-mautic-plugin
```

GitHub reports the repository exists but is private. ClawHub community publishing expects source metadata that ClawHub can fetch and review. To finish public deployment, either make the repository public or configure a private-source review path supported by ClawHub.

Local-folder dry run with explicit source metadata:

```bash
npm run clawhub:dry-run
```

Result: passed. ClawHub detected:

```json
{
  "name": "@completetech/openclaw-mautic-plugin",
  "displayName": "Mautic Control",
  "family": "bundle-plugin",
  "version": "0.1.0"
}
```

This validates the local package shape. It does not remove the public-source review concern for a public ClawHub listing.

## Local Stack Security

OpenClaw state was moved from a Windows bind mount to the `openclaw_state` Docker volume so Unix file permissions are enforceable. The previously critical files now report:

```text
600 node:node /state/agents/main/agent/auth-profiles.json
600 node:node /state/agents/main/sessions/sessions.json
```

Gateway auth rate limiting is configured:

```json
{
  "maxAttempts": 10,
  "windowMs": 60000,
  "lockoutMs": 300000
}
```

## Deployment Decision

Do not publish this package publicly to ClawHub while the repository remains private unless ClawHub has an approved private-source review workflow for this owner.

`npm run clawhub:publish` enforces that decision by refusing private-source publishing unless `CLAWHUB_ALLOW_PRIVATE_SOURCE=1` is set after review access is approved.
