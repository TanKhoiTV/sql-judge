import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = (pkg.version || "0.0.0").trim();

writeFileSync(resolve(root, "public", "VERSION"), version + "\n");
console.log(`Wrote version ${version} → public/VERSION`);
