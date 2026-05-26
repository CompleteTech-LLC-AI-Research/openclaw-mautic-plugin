# Security Policy

## Supported Version

Security fixes are accepted for the current `0.1.x` release line while this plugin is in pre-1.0 review.

## Reporting

Report security issues privately to the repository maintainers before opening a public issue. Include:

- Plugin version and OpenClaw version.
- Mautic version and deployment type.
- Affected tool name.
- Minimal reproduction steps.
- Whether credentials, files, contacts, campaigns, or console operations were exposed or modified.

Do not include live Mautic passwords, API tokens, console bridge tokens, database dumps, or customer data in reports.

## Threat Model

This plugin assumes a trusted OpenClaw operator. It is not designed for hostile multi-tenant gateway use where untrusted users can invoke tools.

Primary risks:

- `mautic_request` and `mautic_entity` can read or modify Mautic data using the configured Mautic API credentials.
- `mautic_console` can run allowlisted Mautic maintenance and automation commands through the optional console bridge.
- `mautic_workspace_file` can inspect or modify files under the configured workspace root when enabled.
- Combining file access with network API access can create data-exfiltration risk if an untrusted agent or user can invoke these tools.

Mitigations:

- Keep OpenClaw gateway authentication enabled.
- Use restrictive tool policies or allowlists for any agent that handles untrusted input.
- Keep `allowMaintenanceCommands`, `allowAutomationJobCommands`, `allowWorkspaceRead`, and `allowWorkspaceWrite` disabled unless needed.
- Scope `workspaceRoot` and `allowedWorkspaceRoot` to a dedicated staging directory.
- Run the console bridge only on an internal network and protect it with `MAUTIC_CONSOLE_TOKEN`.
- Prefer least-privilege Mautic API credentials for production deployments.
- Use HTTPS for Mautic API access outside trusted loopback or private container networks; Basic auth credentials are sent on API requests.
- Keep secrets in environment variables or the platform secret store, not in plugin UI config.

## Transport Security

The Mautic API tools use the configured `baseUrl` and send Basic auth credentials in the HTTP `Authorization` header. Plain HTTP is intended only for trusted local Docker networks, loopback automation, or another private network segment where OpenClaw and Mautic are isolated from untrusted traffic.

For production, hosted, routed, or cross-host deployments, set `baseUrl` to an HTTPS endpoint. Authenticated API tools refuse to send credentials to a routable plain-HTTP host, but operators should still avoid plain HTTP except on trusted loopback or private container networks.

## Console Bridge

`mautic/console-bridge.php` is optional. It should be deployed only where OpenClaw can reach it over a private network. Never expose it directly to the public internet. Rotate `MAUTIC_CONSOLE_TOKEN` if it is logged, shared, or committed by mistake.

## Local State

OpenClaw state files can contain credential and routing metadata. Store OpenClaw state on a filesystem that enforces Unix permissions. Avoid Windows bind mounts for `/state` in production because chmod may be ineffective under Docker Desktop 9p mounts.
