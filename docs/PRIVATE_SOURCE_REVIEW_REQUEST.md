# Private Source Review Request

Use this when requesting a ClawHub private-source review path for `mautic-control`.

## Package

- Package name: `@completetech/openclaw-mautic-plugin`
- Plugin id: `mautic-control`
- Version: `0.1.0`
- Source repository: `CompleteTech-LLC-AI-Research/openclaw-mautic-plugin`
- Current source visibility: private
- Branch: `main`

## Reason For Private Source

CompleteTech LLC AI Research is keeping the source repository private unless ClawHub requires a public source repository for marketplace listing. The package is prepared for review with explicit source metadata and a reproducible local ClawHub dry run.

## Review Commands

Run from the repository root:

```bash
npm run lint
npm test
npm run package:check
npm run clawhub:dry-run
```

Run against the local Docker stack:

```bash
npm run live:smoke
docker compose exec -T openclaw sh -lc 'openclaw security audit --deep --json'
```

The public-source gate is expected to fail until ClawHub can access the repository:

```bash
npm run readiness:check
```

## ClawScan Context

Suggested `--clawscan-note`:

```text
Mautic plugin uses network access for Mautic REST API calls, an optional token-protected private console bridge, and opt-in workspace staging under a guarded root. Production defaults disable maintenance, automation, and workspace file access.
```

## Security Summary

- Mautic API credentials are read from environment variables or platform secret storage, not plugin UI config.
- `mautic_request` is restricted to `/api` and `/api/v2`.
- `mautic_console` uses a hardcoded command allowlist and capability toggles.
- `mautic_workspace_file` is restricted to `workspaceRoot` under `allowedWorkspaceRoot`.
- Production defaults disable maintenance commands, automation commands, workspace read, and workspace write.
- The optional console bridge must run only on a private network and requires `MAUTIC_CONSOLE_TOKEN`.

See also:

- `SECURITY.md`
- `docs/CLAWHUB_READINESS.md`
- `docs/COMPLETION_AUDIT.md`

## Current Known Warning

OpenClaw deep security audit reports one non-critical warning in the local stack:

```text
plugins.tools_reachable_permissive_policy
```

Rationale: the local stack enables `mautic-control` in the default tool context for a trusted single-operator environment.

Mitigation for broader deployment: use restrictive OpenClaw profiles or explicit tool allowlists for agents that handle untrusted input.

## Publish Guard

`npm run clawhub:publish` refuses to publish while the source repository is private unless:

```bash
CLAWHUB_ALLOW_PRIVATE_SOURCE=1 npm run clawhub:publish
```

Only use that override after ClawHub confirms that private-source review is approved for this package.
