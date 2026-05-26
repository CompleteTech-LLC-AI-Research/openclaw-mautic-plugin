#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const sourceRepo = process.env.CLAWHUB_SOURCE_REPO || "CompleteTech-LLC-AI-Research/openclaw-mautic-plugin";
const stackDir = process.env.OPENCLAW_MAUTIC_STACK_DIR || "/mnt/c/Users/timot/Documents/projects/docker/openclaw-mautic-stack";

const checks = [];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function output(result) {
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "ok" : "not ok"} - ${name}${!ok && detail ? ` (${detail})` : ""}`);
}

function commandCheck(name, command, args, options = {}) {
  const result = run(command, args, options);
  record(name, result.status === 0, output(result));
  return result;
}

commandCheck("working tree is clean", "git", ["diff", "--quiet"]);
commandCheck("branch is pushed to origin", "git", ["status", "--short", "--branch"]);
commandCheck("lint passes", "npm", ["run", "lint"]);
commandCheck("unit tests pass", "npm", ["test"]);
commandCheck("package dry-run passes", "npm", ["run", "package:check"]);
commandCheck("local ClawHub package dry-run passes", "npm", ["run", "clawhub:dry-run"]);

const audit = run("docker", ["compose", "exec", "-T", "openclaw", "sh", "-lc", "openclaw security audit --deep --json"], { cwd: stackDir });
let auditJson;
try {
  auditJson = JSON.parse(audit.stdout);
} catch {
  auditJson = null;
}
record("OpenClaw security audit has no critical findings", audit.status === 0 && auditJson?.summary?.critical === 0, output(audit));

const visibility = run("gh", ["repo", "view", sourceRepo, "--json", "visibility", "--jq", ".visibility"]);
const repoVisibility = visibility.status === 0 ? visibility.stdout.trim().toUpperCase() : "UNKNOWN";
record("GitHub source repo is visible to public ClawHub review", repoVisibility === "PUBLIC", `visibility=${repoVisibility}`);

const directDryRun = run("npm", [
  "exec",
  "--yes",
  "clawhub",
  "--",
  "package",
  "publish",
  sourceRepo,
  "--dry-run",
]);
record("direct GitHub-source ClawHub dry-run passes", directDryRun.status === 0, output(directDryRun));

const failed = checks.filter((check) => !check.ok);
if (failed.length) {
  console.error(`\nReadiness check failed: ${failed.length} blocker(s).`);
  console.error("Current expected blocker: private GitHub source repo cannot be fetched by direct ClawHub review.");
  process.exit(1);
}

console.log("\nAll readiness checks passed.");
