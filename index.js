import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONSOLE_COMMANDS,
  ENTITY_NAMES,
  METHODS,
  REQUEST_TIMEOUT_MAX_SECONDS,
  REQUEST_TIMEOUT_MIN_SECONDS,
  assertMauticApiPath,
  assertPathWithinRoot,
  boundedNumber,
  fetchWithTimeout,
  getRuntimeConfig,
  legacyEntityRequest,
  mauticFetch,
  parseCreatedId,
  requireId,
  safeWorkspacePath,
  schema,
  textResult,
  v2EntityRequest,
} from "./lib/runtime.js";

export default definePluginEntry({
  id: "mautic-control",
  name: "Mautic Control",
  description: "Control the local Mautic stack through REST APIs and a safe maintenance bridge.",
  register(api) {
    api.registerTool({
      name: "mautic_status",
      description: "Check local Mautic dashboard reachability, API authentication, and plugin environment wiring.",
      parameters: schema({}),
      async execute() {
        const config = getRuntimeConfig(api);
        const dashboard = await fetchWithTimeout(`${config.baseUrl}/s/dashboard`, { redirect: "manual" }, config.requestTimeoutSeconds)
          .then((response) => ({ ok: response.status === 200 || response.status === 302, status: response.status, location: response.headers.get("location") }))
          .catch((error) => ({ ok: false, error: error.message }));
        const apiProbe = await mauticFetch(config, "/api/contacts", { query: { limit: 1 } });
        return textResult({
          ok: dashboard.ok && apiProbe.ok,
          baseUrl: config.baseUrl,
          transportSecurityWarning: config.transportSecurityWarning,
          dashboard,
          api: { ok: apiProbe.ok, status: apiProbe.status, statusText: apiProbe.statusText },
          consoleBridgeConfigured: Boolean(config.consoleUrl && config.consoleToken),
          workspaceRoot: config.workspaceRoot,
          allowedWorkspaceRoot: config.allowedWorkspaceRoot,
          defaultApiVersion: config.defaultApiVersion,
          requestTimeoutSeconds: config.requestTimeoutSeconds,
          consolePermissionMode: config.consolePermissionMode,
          allowMaintenanceCommands: config.allowMaintenanceCommands,
          allowAutomationJobCommands: config.allowAutomationJobCommands,
          legacyConsoleCommandPolicy: config.consoleCommandPolicy,
          allowedConsoleCommands: config.allowedConsoleCommands,
          allowWorkspaceRead: config.allowWorkspaceRead,
          allowWorkspaceWrite: config.allowWorkspaceWrite,
        });
      },
    }, { optional: true });

    api.registerTool({
      name: "mautic_request",
      description: "Send an authenticated request to a Mautic API path under /api or /api/v2.",
      parameters: schema({
        method: { type: "string", enum: METHODS, default: "GET" },
        path: { type: "string", description: "Mautic path starting with /api or /api/v2." },
        query: { type: "object", additionalProperties: true },
        body: { type: "object", additionalProperties: true },
      }, ["path"]),
      async execute(_id, params) {
        const requestPath = String(params.path || "");
        assertMauticApiPath(requestPath);
        const result = await mauticFetch(getRuntimeConfig(api), requestPath, {
          method: params.method || "GET",
          query: params.query,
          body: params.body,
        });
        return textResult(result);
      },
    }, { optional: true });

    api.registerTool({
      name: "mautic_entity",
      description: "List, get, create, update, or delete a supported Mautic entity through typed resource mappings.",
      parameters: schema({
        entity: { type: "string", enum: ENTITY_NAMES },
        action: { type: "string", enum: ["list", "get", "create", "update", "delete"] },
        id: { anyOf: [{ type: "string" }, { type: "number" }] },
        apiVersion: { type: "string", enum: ["legacy", "v2"], default: "legacy" },
        query: { type: "object", additionalProperties: true },
        body: { type: "object", additionalProperties: true },
      }, ["entity", "action"]),
      async execute(_id, params) {
        const config = getRuntimeConfig(api);
        const action = params.action;
        const apiVersion = params.apiVersion || config.defaultApiVersion;
        requireId(action, params.id);
        const request = apiVersion === "v2"
          ? v2EntityRequest(params.entity, action, params.id)
          : legacyEntityRequest(params.entity, action, params.id);
        const result = await mauticFetch(config, request.path, {
          method: request.method,
          query: params.query,
          body: params.body,
        });
        return textResult({ ...result, entity: params.entity, action, apiVersion, id: params.id, createdId: parseCreatedId(result) });
      },
    }, { optional: true });

    api.registerTool({
      name: "mautic_webhook_triggers",
      description: "List valid Mautic webhook trigger events.",
      parameters: schema({}),
      async execute() {
        const result = await mauticFetch(getRuntimeConfig(api), "/api/hooks/triggers");
        return textResult(result);
      },
    }, { optional: true });

    api.registerTool({
      name: "mautic_console",
      description: "Run an allowlisted safe Mautic maintenance command through the internal console bridge.",
      parameters: schema({
        command: { type: "string", enum: CONSOLE_COMMANDS },
        timeoutSeconds: { type: "number", minimum: 5, maximum: 600, default: 300 },
      }, ["command"]),
      async execute(_id, params) {
        const config = getRuntimeConfig(api);
        if (!config.allowedConsoleCommands.includes(params.command) || !CONSOLE_COMMANDS.includes(params.command)) {
          throw new Error("Command is not allowed by the Mautic console policy");
        }
        if (!config.consoleToken) throw new Error("MAUTIC_CONSOLE_TOKEN must be set");
        const response = await fetchWithTimeout(config.consoleUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Mautic-Console-Token": config.consoleToken,
          },
          body: JSON.stringify({ command: params.command, timeoutSeconds: params.timeoutSeconds || 300 }),
        }, boundedNumber(params.timeoutSeconds || 300, 300, REQUEST_TIMEOUT_MIN_SECONDS, REQUEST_TIMEOUT_MAX_SECONDS));
        const body = await response.json().catch(() => null);
        return textResult({ ok: response.ok && Boolean(body?.ok), status: response.status, body });
      },
    }, { optional: true });

    api.registerTool({
      name: "mautic_workspace_file",
      description: "List, read, write, or delete files staged under /workspace/mautic.",
      parameters: schema({
        action: { type: "string", enum: ["list", "read", "write", "delete"] },
        path: { type: "string", default: "." },
        content: { type: "string" },
      }, ["action"]),
      async execute(_id, params) {
        const config = getRuntimeConfig(api);
        const target = safeWorkspacePath(config.workspaceRoot, params.path || ".");
        assertPathWithinRoot(target, config.allowedWorkspaceRoot, "Path escapes the allowed Mautic workspace root");
        if (["list", "read"].includes(params.action) && !config.allowWorkspaceRead) {
          throw new Error("Workspace read access is disabled by plugin configuration");
        }
        if (["write", "delete"].includes(params.action) && !config.allowWorkspaceWrite) {
          throw new Error("Workspace write/delete access is disabled by plugin configuration");
        }
        if (params.action === "list") {
          const entries = await readdir(target, { withFileTypes: true });
          return textResult({
            path: target,
            entries: await Promise.all(entries.map(async (entry) => {
              const full = path.join(target, entry.name);
              const info = await stat(full);
              return { name: entry.name, type: entry.isDirectory() ? "directory" : "file", size: info.size };
            })),
          });
        }
        if (params.action === "read") {
          return textResult({ path: target, content: await readFile(target, "utf8") });
        }
        if (params.action === "write") {
          await mkdir(path.dirname(target), { recursive: true });
          await writeFile(target, String(params.content ?? ""), "utf8");
          return textResult({ ok: true, path: target });
        }
        if (params.action === "delete") {
          await unlink(target);
          return textResult({ ok: true, path: target });
        }
        throw new Error(`Unsupported workspace action: ${params.action}`);
      },
    }, { optional: true });
  },
});
