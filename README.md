# OpenClaw Mautic Plugin

Native OpenClaw tool plugin for the local Docker Mautic stack.

## Tools

- `mautic_status` checks dashboard reachability and API authentication.
- `mautic_request` sends an authenticated request to `/api` or `/api/v2`.
- `mautic_entity` provides list/get/create/update/delete for supported Mautic resources.
- `mautic_webhook_triggers` lists valid Mautic webhook trigger events.
- `mautic_console` runs an internal allowlist of safe maintenance commands.
- `mautic_workspace_file` reads, writes, lists, and deletes files under `/workspace/mautic`.

## Configuration

OpenClaw shows these non-secret fields in the plugin settings UI under `mautic-control`:

- `baseUrl`, default `http://mautic_web`
- `consoleUrl`, default `http://mautic_console:8099/console`
- `workspaceRoot`, default `/workspace/mautic`
- `allowedWorkspaceRoot`, default `/workspace/mautic`
- `defaultApiVersion`, `legacy` or `v2`, default `legacy`
- `requestTimeoutSeconds`, 5 to 600 seconds, default `60`
- `allowMaintenanceCommands`, default `true`
- `allowAutomationJobCommands`, default `false`

The runtime resolves plugin UI config first, environment variables second, and built-in defaults last.

Console command access uses a status-only baseline plus two capability toggles:

- `migrations:status` is always allowed so OpenClaw can check Mautic migration state.
- `allowMaintenanceCommands` enables `cache:clear`, `mautic:cache:clear`, and `plugins:reload`.
- `allowAutomationJobCommands` enables `webhooks:process`, `campaigns:rebuild`, `campaigns:trigger`, and `segments:update`.

Legacy `consoleCommandPolicy` and `consoleCommandGroups` values are still accepted if an older deployment already has them, but they are not shown in the default settings UI. Raw console command strings are internal and safety-gated. Every resolved toggle or legacy policy is intersected with the plugin's hardcoded safe allowlist before `mautic_console` runs anything.

Secrets stay out of the plugin UI. The installed OpenClaw runtime exposes plugin config as `api.pluginConfig`, but its canonical SecretRef credential surface does not include this custom plugin's Mautic password or console-token paths. This plugin therefore does not add plaintext secret fields. Provide credentials through the OpenClaw container environment:

- `MAUTIC_API_USERNAME`
- `MAUTIC_API_PASSWORD`
- `MAUTIC_CONSOLE_TOKEN`

Optional environment fallbacks for non-secret settings are `MAUTIC_BASE_URL`, `MAUTIC_CONSOLE_URL`, `MAUTIC_WORKSPACE_DIR`, `MAUTIC_ALLOWED_WORKSPACE_ROOT`, `MAUTIC_DEFAULT_API_VERSION`, `MAUTIC_REQUEST_TIMEOUT_SECONDS`, `MAUTIC_ALLOW_MAINTENANCE_COMMANDS`, and `MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS`. `MAUTIC_CONSOLE_COMMAND_POLICY` remains as a legacy fallback only.

The stack enables Mautic Basic auth only for this loopback Docker deployment. Do not expose these services publicly.

## Usage Examples

Invoke tools through the OpenClaw gateway with:

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_status","args":{}}'
```

```json
{ "tool": "mautic_status", "args": {} }
```

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_request","args":{"path":"/api/contacts","query":{"limit":1}}}'
```

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_request","args":{"path":"/api/v2/contacts","query":{"itemsPerPage":1}}}'
```

```json
{ "tool": "mautic_entity", "args": { "entity": "contacts", "action": "list", "query": { "limit": 5 } } }
```

```json
{
  "tool": "mautic_entity",
  "args": {
    "entity": "contacts",
    "action": "create",
    "body": { "firstname": "OpenClaw", "lastname": "Test", "email": "openclaw-test@example.local" }
  }
}
```

```json
{ "tool": "mautic_webhook_triggers", "args": {} }
```

```json
{ "tool": "mautic_console", "args": { "command": "migrations:status" } }
```

```json
{ "tool": "mautic_workspace_file", "args": { "action": "write", "path": "notes/example.txt", "content": "staged from OpenClaw" } }
```

Equivalent gateway call:

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_console","args":{"command":"migrations:status"}}'
```

## Known Limits

- OAuth2 is preferred for external Mautic integrations, but the local verification path uses Basic auth to avoid a manual OAuth approval loop.
- `mautic_console` is intentionally policy-gated and allowlisted. It cannot run arbitrary shell or console commands.
- `mautic_request` is restricted to `/api` and `/api/v2` paths.
- `mautic_workspace_file` is restricted to `workspaceRoot` and the broader `allowedWorkspaceRoot`.
- `mautic_entity` uses Mautic's legacy `/api` patterns by default and supports `/api/v2` through the `apiVersion` argument when needed.
- Plaintext password and console-token UI fields are intentionally not implemented. Use environment variables unless a future deployed OpenClaw version adds a dedicated SecretRef target for this plugin.
