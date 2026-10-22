import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  assertMauticApiPath,
  buildUrl,
  mauticFetch,
  normalizeMauticApiPath,
  probeMauticApi,
  assertPathWithinRoot,
  assertSafeMauticTransport,
  getRuntimeConfig,
  legacyEntityRequest,
  requireId,
  resolveConsoleCommands,
  safeWorkspacePath,
  transportSecurityWarning,
  v2EntityRequest,
} from "../lib/runtime.js";

const ENV_KEYS = [
  "MAUTIC_ALLOW_AUTOMATION_JOB_COMMANDS",
  "MAUTIC_ALLOW_MAINTENANCE_COMMANDS",
  "MAUTIC_ALLOW_WORKSPACE_READ",
  "MAUTIC_ALLOW_WORKSPACE_WRITE",
  "MAUTIC_ALLOWED_WORKSPACE_ROOT",
  "MAUTIC_BASE_URL",
  "MAUTIC_CONSOLE_TOKEN",
  "MAUTIC_CONSOLE_URL",
  "MAUTIC_DEFAULT_API_VERSION",
  "MAUTIC_REQUEST_TIMEOUT_SECONDS",
  "MAUTIC_WORKSPACE_DIR",
];

function withCleanEnv(fn) {
  const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

test("production defaults keep optional command and workspace capabilities disabled", () => {
  withCleanEnv(() => {
    const config = getRuntimeConfig({ pluginConfig: {} });
    assert.equal(config.allowMaintenanceCommands, false);
    assert.equal(config.allowAutomationJobCommands, false);
    assert.equal(config.allowWorkspaceRead, false);
    assert.equal(config.allowWorkspaceWrite, false);
    assert.deepEqual(config.allowedConsoleCommands, ["migrations:status"]);
  });
});

test("local stack config can explicitly opt into maintenance and workspace staging", () => {
  withCleanEnv(() => {
    const config = getRuntimeConfig({
      pluginConfig: {
        baseUrl: "http://mautic_web/",
        allowMaintenanceCommands: true,
        allowAutomationJobCommands: false,
        allowWorkspaceRead: true,
        allowWorkspaceWrite: true,
      },
    });
    assert.equal(config.baseUrl, "http://mautic_web");
    assert.equal(config.transportSecurityWarning.level, "warning");
    assert.equal(config.allowMaintenanceCommands, true);
    assert.equal(config.allowWorkspaceRead, true);
    assert.equal(config.allowWorkspaceWrite, true);
    assert.deepEqual(config.allowedConsoleCommands, [
      "migrations:status",
      "cache:clear",
      "mautic:cache:clear",
      "plugins:reload",
    ]);
  });
});

test("transport warning distinguishes HTTPS, private HTTP, and routable HTTP", () => {
  assert.equal(transportSecurityWarning("https://mautic.example.com"), null);
  assert.equal(transportSecurityWarning("http://mautic_web").level, "warning");
  assert.equal(transportSecurityWarning("http://mautic.example.com").level, "critical");
});

test("authenticated requests refuse unsafe routable HTTP transport", () => {
  assert.doesNotThrow(() => assertSafeMauticTransport({ baseUrl: "https://mautic.example.com" }));
  assert.doesNotThrow(() => assertSafeMauticTransport({ baseUrl: "http://mautic_web" }));
  assert.throws(
    () => assertSafeMauticTransport({ baseUrl: "http://mautic.example.com" }),
    /Refusing to send Mautic API credentials/,
  );
});

test("automation commands are separately opt-in", () => {
  withCleanEnv(() => {
    const policy = resolveConsoleCommands({
      allowMaintenanceCommands: true,
      allowAutomationJobCommands: true,
    });
    assert.equal(policy.mode, "capabilityToggles");
    assert.ok(policy.commands.includes("webhooks:process"));
    assert.ok(policy.commands.includes("campaigns:trigger"));
  });
});

test("legacy console policy is still accepted when no capability toggles are present", () => {
  withCleanEnv(() => {
    const policy = resolveConsoleCommands({ consoleCommandPolicy: "readOnly" });
    assert.equal(policy.mode, "legacyPolicy");
    assert.deepEqual(policy.commands, ["migrations:status"]);
  });
});

test("mautic_request only accepts Mautic API paths", () => {
  assert.doesNotThrow(() => assertMauticApiPath("/api"));
  assert.doesNotThrow(() => assertMauticApiPath("/api/contacts"));
  assert.doesNotThrow(() => assertMauticApiPath("/api/v2/contacts"));
  assert.throws(() => assertMauticApiPath("/s/dashboard"), /must start with \/api/);
  assert.throws(() => assertMauticApiPath("https://example.com/api/contacts"), /must start with \/api/);
});

test("workspace paths cannot escape the configured root", () => {
  assert.equal(
    safeWorkspacePath("/workspace/mautic", "imports/file.csv"),
    path.join(path.resolve("/workspace/mautic"), "imports", "file.csv"),
  );
  assert.throws(() => safeWorkspacePath("/workspace/mautic", "../secrets.txt"), /escapes/);
  assert.throws(
    () => assertPathWithinRoot("/workspace/mautic2/file.txt", "/workspace/mautic", "outside"),
    /outside/,
  );
});

test("entity helpers enforce ids and map legacy and v2 endpoints", () => {
  assert.deepEqual(legacyEntityRequest("contacts", "create"), { method: "POST", path: "/api/contacts/new" });
  assert.deepEqual(v2EntityRequest("contacts", "update", 123), { method: "PATCH", path: "/api/v2/contacts/123" });
  assert.throws(() => requireId("delete"), /id is required/);
});

test("mautic_request rejects path traversal and non-canonical API paths", () => {
  const rejected = [
    "/api/../s/dashboard",
    "/api/./../s/dashboard",
    "/api/contacts/../../s/dashboard",
    "/api/%2e%2e/s/dashboard",
    "/api/%2E%2E/s/dashboard",
    "/api/.%2e/s/dashboard",
    "/api/%252e%252e/s/dashboard",
    "/api/./contacts",
    "/api/contacts/.",
    "/api/..",
    "/api\\..\\s\\dashboard",
    "/api/..\\s/dashboard",
    "/api/%5c../s/dashboard",
    "/api/%2f../s/dashboard",
    "/api//contacts",
    "//evil.example.com/api/contacts",
    "https://evil.example.com/api/contacts",
    "api/contacts",
    "/apifoo",
    "/api/contacts?x=1",
    "/api/contacts#frag",
    "/api/contacts\u0000",
    "",
  ];
  for (const candidate of rejected) {
    assert.throws(() => assertMauticApiPath(candidate), /mautic_request path/, `expected rejection: ${JSON.stringify(candidate)}`);
  }
  assert.equal(normalizeMauticApiPath("/api/contacts/"), "/api/contacts/");
  assert.equal(normalizeMauticApiPath("/api/v2/contacts"), "/api/v2/contacts");
  assert.equal(normalizeMauticApiPath("/api/contacts/1/edit"), "/api/contacts/1/edit");
});

test("built request URLs stay under the configured base /api path", async () => {
  const config = { baseUrl: "https://mautic.example.com/sub", username: "u", password: "p", requestTimeoutSeconds: 5 };
  await assert.rejects(() => mauticFetch(config, "/api/../s/dashboard"), /mautic_request path|outside/);
  assert.equal(buildUrl(config.baseUrl, "/api/contacts").pathname, "/sub/api/contacts");
});

test("entity ids must be positive integers and are never interpolated raw", () => {
  assert.deepEqual(legacyEntityRequest("contacts", "get", "42"), { method: "GET", path: "/api/contacts/42" });
  assert.deepEqual(v2EntityRequest("contacts", "delete", 7), { method: "DELETE", path: "/api/v2/contacts/7" });
  for (const bad of ["..", "../../s/dashboard", "1/../../s", "%2e%2e", "1?x=1", "1#x", "-1", "0", "1.5", "abc", 1.5, -3, 0, NaN]) {
    assert.throws(() => requireId("get", bad), /positive integer/, `expected rejection: ${String(bad)}`);
    assert.throws(() => legacyEntityRequest("contacts", "get", bad), /positive integer/);
    assert.throws(() => v2EntityRequest("contacts", "update", bad), /positive integer/);
  }
  assert.doesNotThrow(() => requireId("list"));
});

test("status API probe reports failures instead of throwing", async () => {
  const missingCreds = await probeMauticApi({ baseUrl: "https://mautic.example.com", username: "", password: "", requestTimeoutSeconds: 5 });
  assert.equal(missingCreds.ok, false);
  assert.match(missingCreds.error, /MAUTIC_API_USERNAME/);
  const unsafe = await probeMauticApi({ baseUrl: "http://mautic.example.com", username: "u", password: "p", requestTimeoutSeconds: 5 });
  assert.equal(unsafe.ok, false);
  assert.match(unsafe.error, /Refusing to send/);
});
