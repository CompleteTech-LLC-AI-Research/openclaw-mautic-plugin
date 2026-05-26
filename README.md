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

Use these production defaults unless a trusted operator needs broader access.

| Step | Action | Guidance |
| --- | --- | --- |
| Connect Mautic | Set baseUrl | Use the internal URL OpenClaw should call, not a public browser URL unless required by your deployment. |
| Add credentials | Provide API username and password | Load them from a secret store or runtime environment, not from plugin UI config. |
| Keep access narrow | Leave optional controls disabled | Enable maintenance, automation, or workspace access only for trusted operators. |
| Add console access only if needed | Deploy the console bridge | The bridge is required only for console commands. All other tools can run without it. |
| Limit agent exposure | Use restrictive OpenClaw profiles | Prefer explicit tool allowlists for agents that process untrusted input. |

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

The plugin starts in a conservative mode. API access becomes available only after credentials are provided, and operational controls stay off until an operator enables them.

### Default Access

| Capability | Default | What That Means |
| --- | --- | --- |
| Mautic API | Available after credentials | Requests are limited to Mautic API routes only: /api and /api/v2. |
| Console status | On | Only migration status is allowed, so OpenClaw can check health without changing Mautic. |
| Maintenance commands | Off | Cache clearing and plugin reloads require an explicit toggle. |
| Automation jobs | Off | Campaign, segment, and webhook job execution requires a separate explicit toggle. |
| Workspace read | Off | File listing and reading are disabled until enabled for a dedicated staging directory. |
| Workspace write | Off | File writes and deletes are disabled until enabled for a dedicated staging directory. |
| Filesystem boundary | Always on | Every workspace path must stay inside the configured allowed workspace root. |

### Optional Command Groups

| Setting | Enables | Intended Use |
| --- | --- | --- |
| allowMaintenanceCommands | cache:clear; mautic:cache:clear; plugins:reload | Routine maintenance after config, plugin, or cache changes. |
| allowAutomationJobCommands | webhooks:process; campaigns:rebuild; campaigns:trigger; segments:update | Intentional campaign, segment, and webhook job execution. |

Console requests are checked twice: first by the plugin allowlist, then by the optional bridge allowlist. For agents that process untrusted input, use restrictive OpenClaw profiles or explicit tool allowlists.

## Console Bridge

The console bridge is optional. It is needed only for the console-command tool; API, entity, webhook, status, and workspace tools can run without it.

Use the included bridge file only as a private internal endpoint between OpenClaw and Mautic.

| Requirement | Production Guidance |
| --- | --- |
| Bridge file | Deploy `mautic/console-bridge.php` only when console commands are required. |
| Network | Keep the bridge on a private network reachable by OpenClaw. |
| Authentication | Protect every request with `MAUTIC_CONSOLE_TOKEN`. |
| Public access | Do not expose the bridge directly to the public internet. |
| Command scope | Keep execution limited to the plugin and bridge allowlists. |

Without the bridge, disable or ignore `mautic_console`; the rest of the plugin remains usable.

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
Trusted publishing uses GitHub Actions OIDC; no long-lived ClawHub token is stored in repository secrets.
The GitHub workflow publishes the checked-in `clawpack/` tarball through ClawHub's official reusable workflow so the release can use both official OIDC and the `npm-pack` artifact path.

Current ClawHub behavior: the release is source-linked to the GitHub commit and passes ClawHub's source provenance readiness check, but community ClawPack bundle releases still display `artifact-only` verification with `hasProvenance=false`.

For a future release:

```bash
npm run readiness:check
rm -rf clawpack
mkdir -p clawpack
npm exec --yes clawhub -- package pack . --pack-destination clawpack --json
gh workflow run clawhub-publish.yml --ref main
```

Optional publish environment variables are `CLAWHUB_OWNER`, `CLAWHUB_CHANGELOG`, `CLAWHUB_SOURCE_REPO`, `CLAWHUB_SOURCE_REF`, `CLAWHUB_TAGS`, `CLAWHUB_CLAWSCAN_NOTE`, and `CLAWHUB_ALLOW_PRIVATE_SOURCE`.

See `docs/TRUSTED_PUBLISHING.md` for the trusted publisher workflow and verification commands.

## Limits

- Pre-1.0 release: validate in the target environment before broad rollout.
- `mautic_console` cannot run arbitrary shell or Mautic console commands.
- `mautic_workspace_file` is for guarded staging workflows, not full filesystem access.
- ClawHub scan status may be pending immediately after a new release is published.
