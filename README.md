# Mautic Control for OpenClaw

OpenClaw plugin for controlled Mautic administration through policy-gated tools.

- Package: `@completetech/openclaw-mautic-plugin`
- Runtime ID: `mautic-control`
- ClawHub: https://clawhub.ai/plugins/%40completetech/openclaw-mautic-plugin
- Source: https://github.com/CompleteTech-LLC-AI-Research/openclaw-mautic-plugin

## Install

```bash
openclaw plugins install clawhub:@completetech/openclaw-mautic-plugin
```

After installation, configure the plugin in OpenClaw's plugin settings and provide Mautic credentials through environment variables or your platform secret store.

## What It Provides

| Tool | Purpose |
| --- | --- |
| `mautic_status` | Checks dashboard reachability, API auth, resolved config, command policy, and workspace policy. |
| `mautic_request` | Sends authenticated requests to Mautic paths under `/api` or `/api/v2`. |
| `mautic_entity` | Provides list/get/create/update/delete operations for supported Mautic resources. |
| `mautic_webhook_triggers` | Lists valid Mautic webhook trigger events. |
| `mautic_console` | Runs allowlisted Mautic console commands through the optional private bridge. |
| `mautic_workspace_file` | Lists, reads, writes, or deletes files under a guarded workspace root when explicitly enabled. |

## Required Secrets

Do not store secrets in plugin UI config, README files, or source control.

| Secret | Purpose |
| --- | --- |
| `MAUTIC_API_USERNAME` | Mautic API username. Use least-privilege credentials. |
| `MAUTIC_API_PASSWORD` | Mautic API password. |
| `MAUTIC_CONSOLE_TOKEN` | Shared token for the optional console bridge. Required only for `mautic_console`. |

OAuth2 is preferred for external production integrations where available. The local verification stack uses Basic auth for loopback-only automation.

## Plugin Settings

These are non-secret settings shown in OpenClaw.

| Setting | Default | Production Guidance |
| --- | --- | --- |
| `baseUrl` | `http://mautic_web` | Set to the internal URL OpenClaw should use for Mautic. |
| `consoleUrl` | `http://mautic_console:8099/console` | Set only if deploying the private console bridge. |
| `workspaceRoot` | `/workspace/mautic` | Dedicated staging directory for file operations. |
| `allowedWorkspaceRoot` | `/workspace/mautic` | Must contain `workspaceRoot`; do not point at a home directory or secrets path. |
| `defaultApiVersion` | `legacy` | Use `legacy` or `v2`, depending on your Mautic API routes. |
| `requestTimeoutSeconds` | `60` | Range: 5 to 600 seconds. |
| `allowMaintenanceCommands` | `false` | Enable only for trusted operators. |
| `allowAutomationJobCommands` | `false` | Enable only when campaign/webhook job execution is intended. |
| `allowWorkspaceRead` | `false` | Enable only for a dedicated staging directory. |
| `allowWorkspaceWrite` | `false` | Enable only for a dedicated staging directory. |

Environment fallbacks are also supported: `MAUTIC_BASE_URL`, `MAUTIC_CONSOLE_URL`, `MAUTIC_WORKSPACE_DIR`, `MAUTIC_ALLOWED_WORKSPACE_ROOT`, `MAUTIC_DEFAULT_API_VERSION`, `MAUTIC_REQUEST_TIMEOUT_SECONDS`, `MAUTIC_ALLOW_MAINTENANCE_COMMANDS`, `MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS`, `MAUTIC_ALLOW_WORKSPACE_READ`, and `MAUTIC_ALLOW_WORKSPACE_WRITE`.

## Security Model

The plugin ships with conservative production defaults. Installing it does not automatically grant file access or operational Mautic job control.

| Area | Default | Guardrail |
| --- | --- | --- |
| Mautic API | Enabled after credentials are provided | Requests are limited to `/api` and `/api/v2`. |
| Console status | Enabled only for `migrations:status` | Useful for health checks without granting maintenance control. |
| Maintenance commands | Disabled | Requires `allowMaintenanceCommands=true`. |
| Automation jobs | Disabled | Requires `allowAutomationJobCommands=true`. |
| Workspace files | Disabled | Read and write require separate opt-in toggles. |
| Path access | Guarded | File paths must stay inside `allowedWorkspaceRoot`. |

Enable capabilities only for operators and agents you trust with that scope.

| Toggle | Commands Enabled | When To Use |
| --- | --- | --- |
| `allowMaintenanceCommands` | `cache:clear`, `mautic:cache:clear`, `plugins:reload` | Routine maintenance after plugin/config/cache changes. |
| `allowAutomationJobCommands` | `webhooks:process`, `campaigns:rebuild`, `campaigns:trigger`, `segments:update` | Intentional campaign, segment, and webhook job execution. |

Console requests are checked twice: first by the plugin's hardcoded allowlist, then by the optional bridge's allowlist. For agents that process untrusted input, use restrictive OpenClaw profiles or explicit tool allowlists.

## Console Bridge

`mautic_console` requires `mautic/console-bridge.php`. All other tools can work without it.

Deploy the bridge only on a private network reachable by OpenClaw and never expose it directly to the public internet. The plugin sends `MAUTIC_CONSOLE_TOKEN` as `X-Mautic-Console-Token`; the bridge also applies its own command allowlist.

## Local Docker Stack

The companion Docker stack uses explicit local config:

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

Those values preserve the local development workflow. Do not expose the local stack's loopback-only credentials or Basic auth settings publicly.

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

The package is already published on ClawHub as `@completetech/openclaw-mautic-plugin`.

For a future release:

```bash
npm run readiness:check
npm run clawhub:publish
```

Optional publish environment variables are `CLAWHUB_OWNER`, `CLAWHUB_CHANGELOG`, `CLAWHUB_SOURCE_REPO`, `CLAWHUB_SOURCE_REF`, `CLAWHUB_TAGS`, `CLAWHUB_CLAWSCAN_NOTE`, and `CLAWHUB_ALLOW_PRIVATE_SOURCE`.

## Known Limits

- This is a pre-1.0 release; validate it in the target environment before broad rollout.
- `mautic_console` cannot run arbitrary shell or Mautic console commands.
- `mautic_workspace_file` is for guarded staging workflows, not full filesystem access.
- ClawHub scan status may be pending immediately after a new release is published.
