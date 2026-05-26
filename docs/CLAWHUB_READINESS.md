# ClawHub Readiness

Last audited: 2026-05-26

## Status

The plugin package, public GitHub source, and local OpenClaw/Mautic stack are ready for ClawHub review.

Current repository:

- `CompleteTech-LLC-AI-Research/openclaw-mautic-plugin`
- Visibility: public
- Latest pushed branch: `main`

## Passing Checks

- `npm test`
- `npm run lint`
- `npm run package:check`
- `npm run live:smoke`
- `npm run readiness:check`
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

```json
{
  "source": "github:CompleteTech-LLC-AI-Research/openclaw-mautic-plugin@main",
  "name": "@completetech/openclaw-mautic-plugin",
  "displayName": "Mautic Control",
  "family": "bundle-plugin",
  "version": "0.1.8"
}
```

Result: passed. ClawHub can fetch and package the public GitHub source.

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
  "version": "0.1.8"
}
```

This validates the local package shape before publishing.

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

The package is ready for ClawHub publish from the public `main` branch after an operator intentionally runs the publish command.

`npm run clawhub:publish` still guards against accidental private-source publishing if the repository visibility changes later.

If the repository is made private again, use `docs/PRIVATE_SOURCE_REVIEW_REQUEST.md` as the handoff packet for a private-source review path.
