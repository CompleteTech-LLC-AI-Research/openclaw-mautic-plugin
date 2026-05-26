import path from "node:path";

export const ENTITY_PATHS = {
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

export const ENTITY_NAMES = Object.keys(ENTITY_PATHS);
export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const CONSOLE_COMMANDS = [
  "cache:clear",
  "mautic:cache:clear",
  "migrations:status",
  "webhooks:process",
  "campaigns:rebuild",
  "campaigns:trigger",
  "segments:update",
  "plugins:reload",
];
export const CONSOLE_STATUS_COMMANDS = ["migrations:status"];
export const CONSOLE_MAINTENANCE_COMMANDS = ["cache:clear", "mautic:cache:clear", "plugins:reload"];
export const CONSOLE_AUTOMATION_COMMANDS = ["webhooks:process", "campaigns:rebuild", "campaigns:trigger", "segments:update"];
export const CONSOLE_COMMAND_POLICIES = ["readOnly", "maintenance", "automation", "allSafe", "custom"];
export const CONSOLE_POLICY_COMMANDS = {
  readOnly: CONSOLE_STATUS_COMMANDS,
  maintenance: [...CONSOLE_STATUS_COMMANDS, ...CONSOLE_MAINTENANCE_COMMANDS],
  automation: [...CONSOLE_STATUS_COMMANDS, ...CONSOLE_MAINTENANCE_COMMANDS, ...CONSOLE_AUTOMATION_COMMANDS],
  allSafe: CONSOLE_COMMANDS,
};
export const CONSOLE_GROUP_COMMANDS = {
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
export const DEFAULT_CONFIG = {
  baseUrl: "http://mautic_web",
  consoleUrl: "http://mautic_console:8099/console",
  workspaceRoot: "/workspace/mautic",
  allowedWorkspaceRoot: "/workspace/mautic",
  defaultApiVersion: "legacy",
  requestTimeoutSeconds: 60,
  allowMaintenanceCommands: false,
  allowAutomationJobCommands: false,
  allowWorkspaceRead: false,
  allowWorkspaceWrite: false,
};

export const REQUEST_TIMEOUT_MIN_SECONDS = 5;
export const REQUEST_TIMEOUT_MAX_SECONDS = 600;

export function textResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

export function schema(properties, required = []) {
  return { type: "object", additionalProperties: false, properties, required };
}

export function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function pickBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

export function uniqueSafeCommands(commands) {
  return commands.filter((command, index) => CONSOLE_COMMANDS.includes(command) && commands.indexOf(command) === index);
}

export function commandsFromGroups(groups) {
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

export function resolveLegacyConsolePolicy(pluginConfig) {
  const policy = pickEnum(
    pluginConfig.consoleCommandPolicy,
    CONSOLE_COMMAND_POLICIES,
    "maintenance",
  );
  const commands = policy === "custom"
    ? commandsFromGroups(pluginConfig.consoleCommandGroups)
    : CONSOLE_POLICY_COMMANDS[policy];
  return { mode: "legacyPolicy", policy, commands: uniqueSafeCommands(commands || []) };
}

export function resolveConsoleCommands(pluginConfig) {
  const hasToggleConfig = Object.prototype.hasOwnProperty.call(pluginConfig, "allowMaintenanceCommands")
    || Object.prototype.hasOwnProperty.call(pluginConfig, "allowAutomationJobCommands")
    || process.env.MAUTIC_ALLOW_MAINTENANCE_COMMANDS !== undefined
    || process.env.MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS !== undefined;
  const hasLegacyConfig = Object.prototype.hasOwnProperty.call(pluginConfig, "consoleCommandPolicy")
    || Object.prototype.hasOwnProperty.call(pluginConfig, "consoleCommandGroups");
  if (!hasToggleConfig && hasLegacyConfig) {
    return resolveLegacyConsolePolicy(pluginConfig);
  }

  const allowMaintenanceCommands = pickBoolean(
    pluginConfig.allowMaintenanceCommands ?? process.env.MAUTIC_ALLOW_MAINTENANCE_COMMANDS,
    DEFAULT_CONFIG.allowMaintenanceCommands,
  );
  const allowAutomationJobCommands = pickBoolean(
    pluginConfig.allowAutomationJobCommands ?? process.env.MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS,
    DEFAULT_CONFIG.allowAutomationJobCommands,
  );
  const commands = [...CONSOLE_STATUS_COMMANDS];
  if (allowMaintenanceCommands) commands.push(...CONSOLE_MAINTENANCE_COMMANDS);
  if (allowAutomationJobCommands) commands.push(...CONSOLE_AUTOMATION_COMMANDS);
  return {
    mode: "capabilityToggles",
    allowMaintenanceCommands,
    allowAutomationJobCommands,
    commands: uniqueSafeCommands(commands),
  };
}

export function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function getRuntimeConfig(api) {
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
    allowWorkspaceRead: pickBoolean(
      pluginConfig.allowWorkspaceRead ?? process.env.MAUTIC_ALLOW_WORKSPACE_READ,
      DEFAULT_CONFIG.allowWorkspaceRead,
    ),
    allowWorkspaceWrite: pickBoolean(
      pluginConfig.allowWorkspaceWrite ?? process.env.MAUTIC_ALLOW_WORKSPACE_WRITE,
      DEFAULT_CONFIG.allowWorkspaceWrite,
    ),
    consolePermissionMode: consolePolicy.mode,
    allowMaintenanceCommands: consolePolicy.allowMaintenanceCommands,
    allowAutomationJobCommands: consolePolicy.allowAutomationJobCommands,
    consoleCommandPolicy: consolePolicy.policy,
    allowedConsoleCommands: consolePolicy.commands,
  };
}

export function authHeader(env) {
  if (!env.username || !env.password) {
    throw new Error("MAUTIC_API_USERNAME and MAUTIC_API_PASSWORD must be set");
  }
  return `Basic ${Buffer.from(`${env.username}:${env.password}`).toString("base64")}`;
}

export function buildUrl(baseUrl, requestPath, query = {}) {
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

export async function fetchWithTimeout(url, init, timeoutSeconds) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function mauticFetch(config, requestPath, options = {}) {
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

export function entityPath(entity, apiVersion) {
  if (!ENTITY_PATHS[entity]) {
    throw new Error(`Unsupported entity: ${entity}`);
  }
  return ENTITY_PATHS[entity][apiVersion];
}

export function legacyEntityRequest(entity, action, id) {
  const resource = entityPath(entity, "legacy");
  if (action === "list") return { method: "GET", path: `/api/${resource}` };
  if (action === "get") return { method: "GET", path: `/api/${resource}/${id}` };
  if (action === "create") return { method: "POST", path: `/api/${resource}/new` };
  if (action === "update") return { method: "PATCH", path: `/api/${resource}/${id}/edit` };
  if (action === "delete") return { method: "DELETE", path: `/api/${resource}/${id}/delete` };
  throw new Error(`Unsupported action: ${action}`);
}

export function v2EntityRequest(entity, action, id) {
  const resource = entityPath(entity, "v2");
  if (action === "list") return { method: "GET", path: `/api/v2/${resource}` };
  if (action === "get") return { method: "GET", path: `/api/v2/${resource}/${id}` };
  if (action === "create") return { method: "POST", path: `/api/v2/${resource}` };
  if (action === "update") return { method: "PATCH", path: `/api/v2/${resource}/${id}` };
  if (action === "delete") return { method: "DELETE", path: `/api/v2/${resource}/${id}` };
  throw new Error(`Unsupported action: ${action}`);
}

export function requireId(action, id) {
  if (["get", "update", "delete"].includes(action) && (id === undefined || id === null || id === "")) {
    throw new Error(`id is required for ${action}`);
  }
}

export function parseCreatedId(payload) {
  const body = payload?.body;
  if (!body || typeof body !== "object") return undefined;
  for (const key of ["contact", "company", "segment", "campaign", "email", "form", "asset", "page", "tag", "user", "role", "permission", "report", "hook", "webhook"]) {
    const value = body[key];
    if (value && typeof value === "object" && value.id !== undefined) return value.id;
  }
  if (body.id !== undefined) return body.id;
  return undefined;
}

export function assertMauticApiPath(requestPath) {
  if (!requestPath.startsWith("/api/") && !requestPath.startsWith("/api/v2/") && requestPath !== "/api" && requestPath !== "/api/v2") {
    throw new Error("mautic_request path must start with /api or /api/v2");
  }
}

export function safeWorkspacePath(root, relativePath = ".") {
  const resolved = path.resolve(root, relativePath);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error("Path escapes the Mautic workspace");
  }
  return resolved;
}

export function assertPathWithinRoot(target, root, message) {
  const resolved = path.resolve(target);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(`${rootResolved}${path.sep}`)) {
    throw new Error(message);
  }
}
