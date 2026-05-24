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
const CONSOLE_COMMAND_POLICIES = ["readOnly", "maintenance", "automation", "allSafe", "custom"];
const CONSOLE_POLICY_COMMANDS = {
  readOnly: ["migrations:status"],
  maintenance: ["migrations:status", "cache:clear", "mautic:cache:clear", "plugins:reload"],
  automation: [
    "migrations:status",
    "cache:clear",
    "mautic:cache:clear",
    "plugins:reload",
    "webhooks:process",
    "campaigns:rebuild",
    "campaigns:trigger",
    "segments:update",
  ],
  allSafe: CONSOLE_COMMANDS,
};
const CONSOLE_GROUP_COMMANDS = {
  maintenance: {
    cacheClear: "cache:clear",
    mauticCacheClear: "mautic:cache:clear",
    migrationsStatus: "migrations:status",
    pluginsReload: "plugins:reload",
  },
  automation: {
    webhooksProcess: "webhooks:process",
    campaignsRebuild: "campaigns:rebuild",
    campaignsTrigger: "campaigns:trigger",
    segmentsUpdate: "segments:update",
  },
};
const DEFAULT_CONFIG = {
  baseUrl: "http://mautic_web",
  consoleUrl: "http://mautic_console:8099/console",
  workspaceRoot: "/workspace/mautic",
  allowedWorkspaceRoot: "/workspace/mautic",
  defaultApiVersion: "legacy",
  requestTimeoutSeconds: 60,
  consoleCommandPolicy: "maintenance",
};
const REQUEST_TIMEOUT_MIN_SECONDS = 5;
const REQUEST_TIMEOUT_MAX_SECONDS = 600;

function textResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function schema(properties, required = []) {
  return { type: "object", additionalProperties: false, properties, required };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function uniqueSafeCommands(commands) {
  return commands.filter((command, index) => CONSOLE_COMMANDS.includes(command) && commands.indexOf(command) === index);
}

function commandsFromGroups(groups) {
  if (!groups || typeof groups !== "object") return [];
  const commands = [];
  for (const [groupName, fields] of Object.entries(CONSOLE_GROUP_COMMANDS)) {
    const group = groups[groupName];
    if (!group || typeof group !== "object") continue;
    for (const [fieldName, command] of Object.entries(fields)) {
      if (group[fieldName] === true) commands.push(command);
    }
  }
  return uniqueSafeCommands(commands);
}

function resolveConsoleCommands(pluginConfig) {
  const policy = pickEnum(
    pluginConfig.consoleCommandPolicy || process.env.MAUTIC_CONSOLE_COMMAND_POLICY,
    CONSOLE_COMMAND_POLICIES,
    DEFAULT_CONFIG.consoleCommandPolicy,
  );
  const commands = policy === "custom"
    ? commandsFromGroups(pluginConfig.consoleCommandGroups)
    : CONSOLE_POLICY_COMMANDS[policy];
  return { policy, commands: uniqueSafeCommands(commands || []) };
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function getRuntimeConfig(api) {
  const pluginConfig = api?.pluginConfig && typeof api.pluginConfig === "object" ? api.pluginConfig : {};
  const workspaceRoot = nonEmptyString(pluginConfig.workspaceRoot)
    || nonEmptyString(process.env.MAUTIC_WORKSPACE_DIR)
    || DEFAULT_CONFIG.workspaceRoot;
  const allowedWorkspaceRoot = nonEmptyString(pluginConfig.allowedWorkspaceRoot)
    || nonEmptyString(process.env.MAUTIC_ALLOWED_WORKSPACE_ROOT)
    || DEFAULT_CONFIG.allowedWorkspaceRoot;
  assertPathWithinRoot(workspaceRoot, allowedWorkspaceRoot, "Configured workspaceRoot escapes allowedWorkspaceRoot");
  const consolePolicy = resolveConsoleCommands(pluginConfig);
  return {
    baseUrl: stripTrailingSlash(nonEmptyString(pluginConfig.baseUrl) || nonEmptyString(process.env.MAUTIC_BASE_URL) || DEFAULT_CONFIG.baseUrl),
    username: process.env.MAUTIC_API_USERNAME || "",
    password: process.env.MAUTIC_API_PASSWORD || "",
    consoleUrl: nonEmptyString(pluginConfig.consoleUrl) || nonEmptyString(process.env.MAUTIC_CONSOLE_URL) || DEFAULT_CONFIG.consoleUrl,
    consoleToken: process.env.MAUTIC_CONSOLE_TOKEN || "",
    workspaceRoot,
    allowedWorkspaceRoot,
    defaultApiVersion: pickEnum(
      pluginConfig.defaultApiVersion || process.env.MAUTIC_DEFAULT_API_VERSION,
      ["legacy", "v2"],
      DEFAULT_CONFIG.defaultApiVersion,
    ),
    requestTimeoutSeconds: boundedNumber(
      pluginConfig.requestTimeoutSeconds || process.env.MAUTIC_REQUEST_TIMEOUT_SECONDS,
      DEFAULT_CONFIG.requestTimeoutSeconds,
      REQUEST_TIMEOUT_MIN_SECONDS,
      REQUEST_TIMEOUT_MAX_SECONDS,
    ),
    consoleCommandPolicy: consolePolicy.policy,
    allowedConsoleCommands: consolePolicy.commands,
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

async function fetchWithTimeout(url, init, timeoutSeconds) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function mauticFetch(config, requestPath, options = {}) {
  const headers = {
    Accept: "application/json",
    Authorization: authHeader(config),
    ...(options.headers || {}),
  };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const url = buildUrl(config.baseUrl, requestPath, options.query);
  const response = await fetchWithTimeout(url, init, config.requestTimeoutSeconds);
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

function assertPathWithinRoot(target, root, message) {
  const resolved = path.resolve(target);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error(message);
  }
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
        const config = getRuntimeConfig(api);
        const dashboard = await fetchWithTimeout(`${config.baseUrl}/s/dashboard`, { redirect: "manual" }, config.requestTimeoutSeconds)
          .then((response) => ({ ok: response.status === 200 || response.status === 302, status: response.status, location: response.headers.get("location") }))
          .catch((error) => ({ ok: false, error: error.message }));
        const apiProbe = await mauticFetch(config, "/api/contacts", { query: { limit: 1 } });
        return textResult({
          ok: dashboard.ok && apiProbe.ok,
          baseUrl: config.baseUrl,
          dashboard,
          api: { ok: apiProbe.ok, status: apiProbe.status, statusText: apiProbe.statusText },
          consoleBridgeConfigured: Boolean(config.consoleUrl && config.consoleToken),
          workspaceRoot: config.workspaceRoot,
          allowedWorkspaceRoot: config.allowedWorkspaceRoot,
          defaultApiVersion: config.defaultApiVersion,
          requestTimeoutSeconds: config.requestTimeoutSeconds,
          consoleCommandPolicy: config.consoleCommandPolicy,
          allowedConsoleCommands: config.allowedConsoleCommands,
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
