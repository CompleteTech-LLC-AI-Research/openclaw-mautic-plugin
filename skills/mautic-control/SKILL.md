---
name: mautic-control
description: Operate the local Mautic stack through the OpenClaw Mautic tools for API CRUD, webhooks, imports/exports, and safe maintenance.
---

# Mautic Control

Use this skill when the user asks to inspect, configure, automate, import/export, or otherwise operate the local Mautic instance attached to this OpenClaw workspace.

Prefer the typed Mautic tools over shell commands:

- Use `mautic_status` before making changes, especially after container restarts.
- Use `mautic_entity` for normal list/get/create/update/delete work on contacts, companies, segments, campaigns, emails, forms, assets, pages, tags, users, roles, permissions, reports, and webhooks.
- Use `mautic_request` only when a specific API path is needed and no typed entity action fits.
- Use `mautic_webhook_triggers` before creating or updating webhooks so event names are valid.
- Use `mautic_workspace_file` for import/export staging under `/workspace/mautic`.
- Use `mautic_console` only for the built-in allowlist of maintenance commands.

Safety rules:

- Treat this as a local loopback Docker stack. Do not expose Mautic or OpenClaw publicly.
- Read existing records before updating or deleting them.
- For delete tests, create a clearly named temporary record and delete only that record.
- Do not print API passwords, console bridge tokens, or Authorization headers.
- Keep bulk imports/exports staged in `/workspace/mautic` and mention the exact file path used.

Local endpoints:

- From OpenClaw: `http://mautic_web`
- From the host browser: `http://127.0.0.1:8080`
- Mautic dashboard path: `/s/dashboard`

Known limits:

- OAuth2 is Mautic's preferred external API pattern, but this local Docker stack uses Basic auth for loopback-only automation because it avoids a manual OAuth approval flow.
- The console tool is intentionally allowlisted and cannot run arbitrary Mautic or shell commands.
