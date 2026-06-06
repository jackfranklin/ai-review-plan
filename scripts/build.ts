import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = new URL("..", import.meta.url).pathname;

console.log("1/4  Building UI with Vite…");
execSync("npx vite build", { cwd: root, stdio: "inherit" });

const uiPath = path.join(root, "dist/ui/index.html");
const uiHtml = fs.readFileSync(uiPath, "utf-8");
const escaped = uiHtml.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

console.log("2/4  Inlining UI HTML into src/cli/ui-html.ts…");
const uiHtmlTs = path.join(root, "src/cli/ui-html.ts");
const original = fs.readFileSync(uiHtmlTs, "utf-8");
fs.writeFileSync(uiHtmlTs, `export const UI_HTML: string | null = \`${escaped}\`;\n`);

console.log("3/4  Bundling CLI with esbuild…");
try {
  const { build } = await import("esbuild");
  const outfile = path.join(root, "dist/cli.js");
  await build({
    entryPoints: [path.join(root, "src/cli/index.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    banner: { js: "#!/usr/bin/env node" },
  });
  fs.chmodSync(outfile, 0o755);
} finally {
  // Restore the dev stub so source stays clean
  fs.writeFileSync(uiHtmlTs, original);
}

console.log("4/4  Done — dist/cli.js ready.");
