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

The plugin reads these environment variables from the OpenClaw container:

- `MAUTIC_BASE_URL`, default `http://mautic_web`
- `MAUTIC_API_USERNAME`
- `MAUTIC_API_PASSWORD`
- `MAUTIC_CONSOLE_URL`, default `http://mautic_console:8099/console`
- `MAUTIC_CONSOLE_TOKEN`

The stack enables Mautic Basic auth only for this loopback Docker deployment. Do not expose these services publicly.

## Usage Examples

Invoke tools through the OpenClaw gateway with:

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_status","args":{}}'
```

```json
{ "tool": "mautic_status", "args": {} }
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

Equivalent gateway call:

```bash
openclaw gateway call tools.invoke --json --params '{"name":"mautic_console","args":{"command":"migrations:status"}}'
```

## Known Limits

- OAuth2 is preferred for external Mautic integrations, but the local verification path uses Basic auth to avoid a manual OAuth approval loop.
- `mautic_console` is intentionally allowlisted. It cannot run arbitrary shell or console commands.
- `mautic_entity` uses Mautic's legacy `/api` patterns by default and supports `/api/v2` through the `apiVersion` argument when needed.
