import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, "dist");

mkdirSync(dist, { recursive: true });
cpSync(path.join(root, "public"), dist, { recursive: true });
cpSync(path.join(root, "src", "styles"), path.join(dist, "styles"), {
  recursive: true,
  filter: (src) => !src.endsWith(".ts"),
});

console.log("assets copied to dist/");
