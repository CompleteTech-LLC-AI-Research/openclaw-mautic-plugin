# OpenClaw Mautic Plugin

`mautic-control` is an OpenClaw plugin for operating a Mautic instance through typed, policy-gated tools. It supports REST API CRUD, webhook trigger discovery, optional console maintenance, and optional workspace file staging.

The included Docker stack defaults are for local development. General ClawHub deployments must provide their own Mautic URL, credentials, and optional console bridge.

## Tools

- `mautic_status` checks dashboard reachability, API authentication, resolved config, command policy, and workspace policy.
- `mautic_request` sends an authenticated request to a path under `/api` or `/api/v2`.
- `mautic_entity` provides list/get/create/update/delete for supported Mautic resources.
- `mautic_webhook_triggers` lists valid Mautic webhook trigger events.
- `mautic_console` runs an allowlisted command through the optional internal console bridge.
- `mautic_workspace_file` lists, reads, writes, or deletes files under the configured workspace root when explicitly enabled.

## Plugin Configuration

OpenClaw shows these non-secret fields in the plugin settings UI under `mautic-control`:

- `baseUrl`, default `http://mautic_web`
- `consoleUrl`, default `http://mautic_console:8099/console`
- `workspaceRoot`, default `/workspace/mautic`
- `allowedWorkspaceRoot`, default `/workspace/mautic`
- `defaultApiVersion`, `legacy` or `v2`, default `legacy`
- `requestTimeoutSeconds`, 5 to 600 seconds, default `60`
- `allowMaintenanceCommands`, default `false`
- `allowAutomationJobCommands`, default `false`
- `allowWorkspaceRead`, default `false`
- `allowWorkspaceWrite`, default `false`

The runtime resolves plugin UI config first, environment variables second, and built-in defaults last.

Console command access uses a status-only baseline plus two capability toggles:

- `migrations:status` is always allowed so OpenClaw can check Mautic migration state.
- `allowMaintenanceCommands` enables `cache:clear`, `mautic:cache:clear`, and `plugins:reload`.
- `allowAutomationJobCommands` enables `webhooks:process`, `campaigns:rebuild`, `campaigns:trigger`, and `segments:update`.

Legacy `consoleCommandPolicy` and `consoleCommandGroups` values are still accepted if an older deployment already has them, but they are not shown in the default settings UI. Every resolved policy is intersected with the plugin's hardcoded safe allowlist before `mautic_console` runs anything.

## Secrets

Secrets stay out of plugin UI config. Provide credentials through the OpenClaw runtime environment or a platform secret store:

- `MAUTIC_API_USERNAME`
- `MAUTIC_API_PASSWORD`
- `MAUTIC_CONSOLE_TOKEN`

Optional environment fallbacks for non-secret settings are `MAUTIC_BASE_URL`, `MAUTIC_CONSOLE_URL`, `MAUTIC_WORKSPACE_DIR`, `MAUTIC_ALLOWED_WORKSPACE_ROOT`, `MAUTIC_DEFAULT_API_VERSION`, `MAUTIC_REQUEST_TIMEOUT_SECONDS`, `MAUTIC_ALLOW_MAINTENANCE_COMMANDS`, `MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS`, `MAUTIC_ALLOW_WORKSPACE_READ`, and `MAUTIC_ALLOW_WORKSPACE_WRITE`. `MAUTIC_CONSOLE_COMMAND_POLICY` remains as a legacy fallback only.

Use least-privilege Mautic credentials for production. OAuth2 is preferred for external Mautic integrations, but the local verification stack uses Basic auth for loopback-only automation.

## Console Bridge

`mautic_console` requires `mautic/console-bridge.php`. All other tools can work without the bridge.

Deploy the bridge only on a private network where OpenClaw can reach it. Set a strong `MAUTIC_CONSOLE_TOKEN`; the plugin sends it as `X-Mautic-Console-Token`. Do not expose the bridge directly to the public internet.

The bridge itself also has a hardcoded command allowlist. The plugin applies its own allowlist before making the bridge request, so both sides must allow a command.

## Workspace File Access

`mautic_workspace_file` is disabled by default for production. Enable `allowWorkspaceRead` for list/read operations and `allowWorkspaceWrite` for write/delete operations. Both `workspaceRoot` and each requested path must remain under `allowedWorkspaceRoot`.

Use a dedicated staging directory. Do not point `allowedWorkspaceRoot` at a full application checkout, home directory, or directory containing secrets.

## Local Docker Stack

The companion stack uses explicit config to preserve the local workflow:

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

The stack binds Mautic and OpenClaw to loopback host ports. Do not expose local development passwords or loopback-only Basic auth settings publicly.

## Usage Examples

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_status","args":{}}'
```

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_request","args":{"path":"/api/contacts","query":{"limit":1}}}'
```

```json
{ "tool": "mautic_entity", "args": { "entity": "contacts", "action": "list", "query": { "limit": 5 } } }
```

```json
{ "tool": "mautic_console", "args": { "command": "migrations:status" } }
```

```json
{ "tool": "mautic_workspace_file", "args": { "action": "write", "path": "notes/example.txt", "content": "staged from OpenClaw" } }
```

## Verification

Run local package checks:

```bash
npm test
npm run package:check
```

Run live checks from the companion stack after it is running:

```bash
node scripts/audit.mjs
docker compose exec -T openclaw sh -lc 'openclaw security audit --deep --json'
```

Before publishing to ClawHub, run the ClawHub package dry-run command available in the target OpenClaw installation and address all critical findings.

## Known Limits

- The plugin is a pre-1.0 release and should be reviewed in the target environment before broad rollout.
- `mautic_request` is restricted to `/api` and `/api/v2` paths.
- `mautic_console` cannot run arbitrary shell or Mautic console commands.
- `mautic_workspace_file` is restricted to `workspaceRoot` and `allowedWorkspaceRoot`, and requires explicit read/write toggles.
- Public ClawHub distribution requires the source repository to be public or otherwise accessible to ClawHub review.
