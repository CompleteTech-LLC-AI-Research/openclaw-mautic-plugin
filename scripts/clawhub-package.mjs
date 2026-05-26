#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = new Set(process.argv.slice(2));
const publish = args.has("--publish");
const allowDirty = args.has("--allow-dirty");
const json = !args.has("--no-json");
const allowPrivateSource = process.env.CLAWHUB_ALLOW_PRIVATE_SOURCE === "1";

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function requireSuccess(result, label) {
  if (result.status !== 0) {
    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    throw new Error(`${label} failed${output ? `:\n${output}` : ""}`);
  }
  return result.stdout.trim();
}

function sourceRepoFromPackage() {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const url = pkg.repository?.url || "";
  const match = url.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/);
  if (!match) {
    throw new Error("Could not derive GitHub source repo from package.json repository.url");
  }
  return match[1].replace(/^git\+/, "");
}

function repoVisibility(sourceRepo) {
  const result = run("gh", ["repo", "view", sourceRepo, "--json", "visibility", "--jq", ".visibility"]);
  if (result.status !== 0) return "UNKNOWN";
  return result.stdout.trim().toUpperCase();
}

const status = requireSuccess(run("git", ["status", "--porcelain"]), "git status");
if (status && !allowDirty) {
  throw new Error("Working tree is dirty. Commit changes first or pass --allow-dirty for a local dry-run only.");
}

const commit = requireSuccess(run("git", ["rev-parse", "HEAD"]), "git rev-parse");
const sourceRepo = process.env.CLAWHUB_SOURCE_REPO || sourceRepoFromPackage();
const sourceRef = process.env.CLAWHUB_SOURCE_REF || "main";
const tags = process.env.CLAWHUB_TAGS || "latest,mautic,marketing-automation,crm,webhooks,openclaw";
const owner = process.env.CLAWHUB_OWNER;
const changelog = process.env.CLAWHUB_CHANGELOG;
const clawscanNote = process.env.CLAWHUB_CLAWSCAN_NOTE
  || "Mautic plugin uses network access for Mautic REST API calls, an optional token-protected private console bridge, and opt-in workspace staging under a guarded root. Production defaults disable maintenance, automation, and workspace file access.";

if (publish) {
  const visibility = repoVisibility(sourceRepo);
  if (visibility !== "PUBLIC" && !allowPrivateSource) {
    throw new Error(
      `Refusing to publish because source repo ${sourceRepo} visibility is ${visibility}. `
      + "Make the repo public or set CLAWHUB_ALLOW_PRIVATE_SOURCE=1 only after ClawHub has approved a private-source review path.",
    );
  }
}

const packDir = mkdtempSync(join(tmpdir(), "mautic-control-clawpack-"));
const packResult = run("npm", [
  "exec",
  "--yes",
  "clawhub",
  "--",
  "package",
  "pack",
  ".",
  "--pack-destination",
  packDir,
  "--json",
]);

let packed;
try {
  packed = JSON.parse(requireSuccess(packResult, "clawhub package pack"));
} catch (error) {
  rmSync(packDir, { recursive: true, force: true });
  if (error instanceof SyntaxError) {
    throw new Error(`clawhub package pack returned invalid JSON:\n${packResult.stdout || ""}${packResult.stderr || ""}`);
  }
  throw error;
}

const command = [
  "exec",
  "--yes",
  "clawhub",
  "--",
  "package",
  "publish",
  packed.path,
  "--source-repo",
  sourceRepo,
  "--source-commit",
  commit,
  "--source-ref",
  sourceRef,
  "--tags",
  tags,
  "--clawscan-note",
  clawscanNote,
];

if (!publish) command.push("--dry-run");
if (json) command.push("--json");
if (owner) command.push("--owner", owner);
if (changelog) command.push("--changelog", changelog);

const result = run("npm", command, { stdio: "inherit" });
rmSync(packDir, { recursive: true, force: true });
process.exit(result.status ?? 1);
