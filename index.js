import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ENTITY_PATHS = {
  contacts: { legacy: "contacts", v2: "contacts" },
  companies: { legacy: "companies", v2: "companies" },
  segments: { legacy: "segments", v2: "segments" },
  campaigns: { legacy: "campaigns", v2: "campaigns" },
  emails: { legacy: "emails", v2: "emails" },
  forms: { legacy: "forms", v2: "forms" },
  assets: { legacy: "assets", v2: "assets" },
  pages: { legacy: "pages", v2: "pages" },
  tags: { legacy: "tags", v2: "tags" },
  users: { legacy: "users", v2: "users" },
  roles: { legacy: "roles", v2: "roles" },
  permissions: { legacy: "permissions", v2: "permissions" },
  reports: { legacy: "reports", v2: "reports" },
  webhooks: { legacy: "hooks", v2: "webhooks" },
};

const ENTITY_NAMES = Object.keys(ENTITY_PATHS);
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const CONSOLE_COMMANDS = [
  "cache:clear",
  "mautic:cache:clear",
  "migrations:status",
  "webhooks:process",
  "campaigns:rebuild",
  "campaigns:trigger",
  "segments:update",
  "plugins:reload",
];

function textResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function schema(properties, required = []) {
  return { type: "object", additionalProperties: false, properties, required };
}

function getEnv() {
  return {
    baseUrl: (process.env.MAUTIC_BASE_URL || "http://mautic_web").replace(/\/+$/, ""),
    username: process.env.MAUTIC_API_USERNAME || "",
    password: process.env.MAUTIC_API_PASSWORD || "",
    consoleUrl: process.env.MAUTIC_CONSOLE_URL || "http://mautic_console:8099/console",
    consoleToken: process.env.MAUTIC_CONSOLE_TOKEN || "",
    workspaceRoot: process.env.MAUTIC_WORKSPACE_DIR || "/workspace/mautic",
  };
}

function authHeader(env) {
  if (!env.username || !env.password) {
    throw new Error("MAUTIC_API_USERNAME and MAUTIC_API_PASSWORD must be set");
  }
  return `Basic ${Buffer.from(`${env.username}:${env.password}`).toString("base64")}`;
}

function buildUrl(baseUrl, requestPath, query = {}) {
  const cleanPath = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const url = new URL(`${baseUrl}${cleanPath}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function mauticFetch(requestPath, options = {}) {
  const env = getEnv();
  const headers = {
    Accept: "application/json",
    Authorization: authHeader(env),
    ...(options.headers || {}),
  };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const url = buildUrl(env.baseUrl, requestPath, options.query);
  const response = await fetch(url, init);
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url: url.toString().replace(/([?&](?:access_token|token|password)=)[^&]+/gi, "$1[redacted]"),
    body,
  };
}

function entityPath(entity, apiVersion) {
  if (!ENTITY_PATHS[entity]) {
    throw new Error(`Unsupported entity: ${entity}`);
  }
  return ENTITY_PATHS[entity][apiVersion];
}

function legacyEntityRequest(entity, action, id) {
  const resource = entityPath(entity, "legacy");
  if (action === "list") return { method: "GET", path: `/api/${resource}` };
  if (action === "get") return { method: "GET", path: `/api/${resource}/${id}` };
  if (action === "create") return { method: "POST", path: `/api/${resource}/new` };
  if (action === "update") return { method: "PATCH", path: `/api/${resource}/${id}/edit` };
  if (action === "delete") return { method: "DELETE", path: `/api/${resource}/${id}/delete` };
  throw new Error(`Unsupported action: ${action}`);
}

function v2EntityRequest(entity, action, id) {
  const resource = entityPath(entity, "v2");
  if (action === "list") return { method: "GET", path: `/api/v2/${resource}` };
  if (action === "get") return { method: "GET", path: `/api/v2/${resource}/${id}` };
  if (action === "create") return { method: "POST", path: `/api/v2/${resource}` };
  if (action === "update") return { method: "PATCH", path: `/api/v2/${resource}/${id}` };
  if (action === "delete") return { method: "DELETE", path: `/api/v2/${resource}/${id}` };
  throw new Error(`Unsupported action: ${action}`);
}

function requireId(action, id) {
  if (["get", "update", "delete"].includes(action) && (id === undefined || id === null || id === "")) {
    throw new Error(`id is required for ${action}`);
  }
}

function parseCreatedId(payload) {
  const body = payload?.body;
  if (!body || typeof body !== "object") return undefined;
  for (const key of ["contact", "company", "segment", "campaign", "email", "form", "asset", "page", "tag", "user", "role", "permission", "report", "hook", "webhook"]) {
    const value = body[key];
    if (value && typeof value === "object" && value.id !== undefined) return value.id;
  }
  if (body.id !== undefined) return body.id;
  return undefined;
}

function safeWorkspacePath(root, relativePath = ".") {
  const resolved = path.resolve(root, relativePath);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error("Path escapes the Mautic workspace");
  }
  return resolved;
}

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
        const env = getEnv();
        const dashboard = await fetch(`${env.baseUrl}/s/dashboard`, { redirect: "manual" })
          .then((response) => ({ ok: response.status === 200 || response.status === 302, status: response.status, location: response.headers.get("location") }))
          .catch((error) => ({ ok: false, error: error.message }));
        const apiProbe = await mauticFetch("/api/contacts", { query: { limit: 1 } });
        return textResult({
          ok: dashboard.ok && apiProbe.ok,
          baseUrl: env.baseUrl,
          dashboard,
          api: { ok: apiProbe.ok, status: apiProbe.status, statusText: apiProbe.statusText },
          consoleBridgeConfigured: Boolean(env.consoleUrl && env.consoleToken),
          workspaceRoot: env.workspaceRoot,
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
        if (!requestPath.startsWith("/api/") && !requestPath.startsWith("/api/v2/") && requestPath !== "/api" && requestPath !== "/api/v2") {
          throw new Error("mautic_request path must start with /api or /api/v2");
        }
        const result = await mauticFetch(requestPath, {
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
        const action = params.action;
        const apiVersion = params.apiVersion || "legacy";
        requireId(action, params.id);
        const request = apiVersion === "v2"
          ? v2EntityRequest(params.entity, action, params.id)
          : legacyEntityRequest(params.entity, action, params.id);
        const result = await mauticFetch(request.path, {
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
        const result = await mauticFetch("/api/hooks/triggers");
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
        const env = getEnv();
        if (!env.consoleToken) throw new Error("MAUTIC_CONSOLE_TOKEN must be set");
        const response = await fetch(env.consoleUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Mautic-Console-Token": env.consoleToken,
          },
          body: JSON.stringify({ command: params.command, timeoutSeconds: params.timeoutSeconds || 300 }),
        });
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
        const env = getEnv();
        const target = safeWorkspacePath(env.workspaceRoot, params.path || ".");
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
