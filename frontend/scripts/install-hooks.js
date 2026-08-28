import { existsSync, copyFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Runs on `npm install` (via the "prepare" script) so the repo's pre-commit lint check
// is wired up automatically on a fresh clone — copies scripts/pre-commit into
// .git/hooks/pre-commit rather than setting core.hooksPath, so it doesn't touch git config.
const frontendDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.dirname(frontendDir);
const gitDir = path.join(repoRoot, ".git");

if (!existsSync(gitDir)) {
  // Not a git checkout (e.g. installed from a tarball) — nothing to wire up.
  process.exit(0);
}

const source = path.join(repoRoot, "scripts", "pre-commit");
const dest = path.join(gitDir, "hooks", "pre-commit");

if (!existsSync(source)) {
  process.exit(0);
}

copyFileSync(source, dest);
chmodSync(dest, 0o755);
console.log("Installed pre-commit hook -> .git/hooks/pre-commit");
