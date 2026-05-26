#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";

const defaultStackDir = path.resolve(new URL("../../openclaw-mautic-stack", import.meta.url).pathname);
const stackDir = process.env.OPENCLAW_MAUTIC_STACK_DIR
  || process.argv.find((arg) => arg.startsWith("--stack-dir="))?.slice("--stack-dir=".length)
  || defaultStackDir;

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const prefix = ok ? "ok" : "not ok";
  console.log(`${prefix} - ${name}${detail && !ok ? ` (${detail})` : ""}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: stackDir,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  return result;
}

function composeExec(script) {
  return run("docker", ["compose", "exec", "-T", "openclaw", "sh", "-lc", script]);
}

function gatewayCall(name, args, allowFailure = false) {
  const params = JSON.stringify({ name, args });
  const result = run("docker", [
    "compose",
    "exec",
    "-T",
    "-e",
    `OPENCLAW_TOOL_PARAMS=${params}`,
    "openclaw",
    "sh",
    "-lc",
    'openclaw gateway call tools.invoke --json --params "$OPENCLAW_TOOL_PARAMS"',
  ]);
  if (result.status !== 0 && !allowFailure) {
    throw new Error((result.stderr || result.stdout || `exit ${result.status}`).trim());
  }
  const output = (result.stdout || result.stderr || "").trim();
  try {
    return JSON.parse(output);
  } catch {
    if (allowFailure) return { ok: false, raw: output, status: result.status };
    throw new Error(`Could not parse gateway output: ${output}`);
  }
}

const ps = run("docker", ["compose", "ps", "--format", "json"]);
record("docker compose ps is available", ps.status === 0, ps.stderr.trim());

const perms = composeExec('stat -c "%a %U:%G %n" /state/agents/main/agent/auth-profiles.json /state/agents/main/sessions/sessions.json');
record("OpenClaw state files are not world-readable", perms.status === 0 && !perms.stdout.includes("777"), perms.stderr.trim() || perms.stdout.trim());

const status = gatewayCall("mautic_status", {});
record("mautic_status passes", status.ok === true && status.output?.details?.ok === true, JSON.stringify(status));
record("local maintenance commands are enabled", status.output?.details?.allowMaintenanceCommands === true, JSON.stringify(status.output?.details));
record("automation commands remain disabled", status.output?.details?.allowAutomationJobCommands === false, JSON.stringify(status.output?.details));
record("workspace read/write is enabled for local stack", status.output?.details?.allowWorkspaceRead === true && status.output?.details?.allowWorkspaceWrite === true, JSON.stringify(status.output?.details));

const migrations = gatewayCall("mautic_console", { command: "migrations:status" });
record("mautic_console migrations:status passes", migrations.ok === true && migrations.output?.details?.ok === true, JSON.stringify(migrations));

const automation = gatewayCall("mautic_console", { command: "webhooks:process" }, true);
record("mautic_console rejects automation when disabled", automation.ok === false, JSON.stringify(automation));

const write = gatewayCall("mautic_workspace_file", {
  action: "write",
  path: "notes/live-smoke.txt",
  content: "openclaw mautic live smoke",
});
record("mautic_workspace_file writes nested file", write.ok === true && write.output?.details?.ok === true, JSON.stringify(write));

const read = gatewayCall("mautic_workspace_file", { action: "read", path: "notes/live-smoke.txt" });
record("mautic_workspace_file reads nested file", read.ok === true && read.output?.details?.content === "openclaw mautic live smoke", JSON.stringify(read));

const audit = composeExec("openclaw security audit --deep --json");
let auditJson = null;
try {
  auditJson = JSON.parse(audit.stdout);
} catch {
  // handled below
}
record("OpenClaw deep security audit has no critical findings", audit.status === 0 && auditJson?.summary?.critical === 0, audit.stderr.trim() || audit.stdout.trim());

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\n${failed.length} live smoke check(s) failed.`);
  process.exit(1);
}

console.log("\nAll live smoke checks passed.");
