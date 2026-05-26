# Mautic Control for OpenClaw

Operate Mautic from OpenClaw with typed, policy-gated tools for API work, webhook discovery, safe console maintenance, and guarded workspace file staging.

| Item | Value |
| --- | --- |
| ClawHub package | `@completetech/openclaw-mautic-plugin` |
| Runtime ID | `mautic-control` |
| OpenClaw compatibility | `>=2026.5.22` |
| ClawHub artifact | ClawPack npm-pack `.tgz` |
| Tested Mautic version | Mautic Community `7.1.1` |
| Mautic series | Built for current Mautic 7.x REST API deployments |
| Source | https://github.com/CompleteTech-LLC-AI-Research/openclaw-mautic-plugin |

## Install

```bash
openclaw plugins install clawhub:@completetech/openclaw-mautic-plugin
```

After installation, set the Mautic connection values in OpenClaw plugin settings and provide API credentials through environment variables or your platform secret store.

## Compatibility

This release was verified against Mautic Community `7.1.1`, the latest GitHub release checked on 2026-05-26. Mautic's own release page lists Mautic 7 as the actively supported series.

Expected production target:

| Component | Supported Target |
| --- | --- |
| OpenClaw Gateway | `2026.5.22` or newer |
| Mautic | Mautic 7.x, tested with `7.1.1` |
| Mautic API | Legacy `/api` routes and `/api/v2` where available |
| Console bridge | Optional, private network only |
| Workspace file access | Optional, dedicated staging directory only |

Validate against your exact Mautic instance before broad rollout, especially if custom plugins, nonstandard API routing, or reverse proxies are involved.

## Tools

| Tool | What It Does | Requires |
| --- | --- | --- |
| `mautic_status` | Checks dashboard reachability, API auth, resolved config, command policy, and workspace policy. | API credentials |
| `mautic_request` | Sends authenticated requests to Mautic paths under `/api` or `/api/v2`. | API credentials |
| `mautic_entity` | Lists, reads, creates, updates, and deletes supported Mautic resources. | API credentials |
| `mautic_webhook_triggers` | Lists valid Mautic webhook trigger events. | Plugin only |
| `mautic_console` | Runs allowlisted Mautic console commands through the private bridge. | Console bridge and token |
| `mautic_workspace_file` | Lists, reads, writes, or deletes files under a guarded workspace root. | Workspace toggles |

## Production Setup

1. Set `baseUrl` to the internal URL OpenClaw should use for Mautic.
2. Provide `MAUTIC_API_USERNAME` and `MAUTIC_API_PASSWORD` from a secret store or runtime environment.
3. Keep maintenance, automation, and workspace access disabled unless the operator needs them.
4. Deploy `mautic/console-bridge.php` only if `mautic_console` is required.
5. Use restrictive OpenClaw profiles or explicit tool allowlists for agents that process untrusted input.

## Required Secrets

Never store these values in the plugin UI, README, or source control.

| Secret | Purpose |
| --- | --- |
| `MAUTIC_API_USERNAME` | Mautic API username. Use least-privilege credentials. |
| `MAUTIC_API_PASSWORD` | Mautic API password. |
| `MAUTIC_CONSOLE_TOKEN` | Shared token for the optional console bridge. Required only for `mautic_console`. |

OAuth2 is preferred for external production integrations where available. The local verification stack uses Basic auth only for loopback automation.

## Plugin Settings

These settings are non-secret and can be configured in OpenClaw.

| Setting | Default | Production Guidance |
| --- | --- | --- |
| `baseUrl` | `http://mautic_web` | Internal Mautic URL reachable by OpenClaw. |
| `consoleUrl` | `http://mautic_console:8099/console` | Internal bridge URL. Leave unused if console commands are not needed. |
| `workspaceRoot` | `/workspace/mautic` | Dedicated staging directory for file operations. |
| `allowedWorkspaceRoot` | `/workspace/mautic` | Hard boundary for file access. Do not use a home directory or secrets path. |
| `defaultApiVersion` | `legacy` | Use `legacy` or `v2` based on your Mautic routes. |
| `requestTimeoutSeconds` | `60` | HTTP timeout. Range: 5 to 600 seconds. |
| `allowMaintenanceCommands` | `false` | Enables cache/plugin maintenance commands. |
| `allowAutomationJobCommands` | `false` | Enables campaign, segment, and webhook job commands. |
| `allowWorkspaceRead` | `false` | Enables list/read under `workspaceRoot`. |
| `allowWorkspaceWrite` | `false` | Enables write/delete under `workspaceRoot`. |

Environment fallbacks are supported for non-secret settings:

```text
MAUTIC_BASE_URL
MAUTIC_CONSOLE_URL
MAUTIC_WORKSPACE_DIR
MAUTIC_ALLOWED_WORKSPACE_ROOT
MAUTIC_DEFAULT_API_VERSION
MAUTIC_REQUEST_TIMEOUT_SECONDS
MAUTIC_ALLOW_MAINTENANCE_COMMANDS
MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS
MAUTIC_ALLOW_WORKSPACE_READ
MAUTIC_ALLOW_WORKSPACE_WRITE
```

## Security Defaults

Installing the plugin does not automatically grant file access or operational Mautic job control.

| Area | Default | Guardrail |
| --- | --- | --- |
| Mautic API | Available after credentials are provided | Requests are limited to `/api` and `/api/v2`. |
| Console health check | `migrations:status` only | Allows migration status without maintenance control. |
| Maintenance commands | Disabled | Requires `allowMaintenanceCommands=true`. |
| Automation jobs | Disabled | Requires `allowAutomationJobCommands=true`. |
| Workspace files | Disabled | Read and write are separate opt-ins. |
| Path access | Guarded | File paths must stay inside `allowedWorkspaceRoot`. |

| Toggle | Commands Enabled | Intended Use |
| --- | --- | --- |
| `allowMaintenanceCommands` | `cache:clear`, `mautic:cache:clear`, `plugins:reload` | Routine maintenance after config, plugin, or cache changes. |
| `allowAutomationJobCommands` | `webhooks:process`, `campaigns:rebuild`, `campaigns:trigger`, `segments:update` | Intentional campaign, segment, and webhook job execution. |

Console requests are checked by the plugin allowlist and again by the optional bridge allowlist.

## Console Bridge

`mautic_console` requires `mautic/console-bridge.php`. All other tools can run without the bridge.

Bridge requirements:

- Run it only on a private network reachable by OpenClaw.
- Protect it with `MAUTIC_CONSOLE_TOKEN`.
- Do not expose it directly to the public internet.
- Keep command access limited to the plugin's documented allowlist.

## Local Docker Stack

The companion Docker stack uses explicit local settings to preserve the development workflow:

```text
baseUrl=http://mautic_web
consoleUrl=http://mautic_console:8099/console
workspaceRoot=/workspace/mautic
allowedWorkspaceRoot=/workspace/mautic
defaultApiVersion=legacy
requestTimeoutSeconds=60
allowMaintenanceCommands=true
allowAutomationJobCommands=false
allowWorkspaceRead=true
allowWorkspaceWrite=true
```

These are local-stack defaults, not production defaults. Do not expose the local stack's loopback credentials or Basic auth settings publicly.

## Verify

Package checks:

```bash
npm run lint
npm test
npm run package:check
```

ClawHub readiness:

```bash
npm run readiness:check
```

Live stack checks:

```bash
npm run live:smoke
node scripts/audit.mjs
node scripts/audit.mjs --live
docker compose exec -T openclaw sh -lc 'openclaw security audit --deep --json'
```

## Publish

The package is published on ClawHub as `@completetech/openclaw-mautic-plugin`.

Releases are published as a ClawPack npm-pack artifact, not the older legacy zip artifact.

For a future release:

```bash
npm run readiness:check
npm run clawhub:publish
```

Optional publish environment variables are `CLAWHUB_OWNER`, `CLAWHUB_CHANGELOG`, `CLAWHUB_SOURCE_REPO`, `CLAWHUB_SOURCE_REF`, `CLAWHUB_TAGS`, `CLAWHUB_CLAWSCAN_NOTE`, and `CLAWHUB_ALLOW_PRIVATE_SOURCE`.

## Limits

- Pre-1.0 release: validate in the target environment before broad rollout.
- `mautic_console` cannot run arbitrary shell or Mautic console commands.
- `mautic_workspace_file` is for guarded staging workflows, not full filesystem access.
- ClawHub scan status may be pending immediately after a new release is published.
