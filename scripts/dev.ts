import { createServer as createVite } from "vite";
import { createServer as createPlanServer } from "../src/server/server.js";
import type { AiAnnotationsFile } from "../src/server/server.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_PORT = 3001;
const UI_PORT = 5173;
const mode = process.argv.includes("--diff") ? "diff" : "plan";
const PLAN_PATH = path.join(
  root,
  mode === "diff" ? "fixtures/sample-diff.diff" : "fixtures/sample-plan.md"
);
const ANNOTATIONS_PATH = path.join(
  root,
  mode === "diff"
    ? "fixtures/sample-annotations-diff.json"
    : "fixtures/sample-annotations-plan.json"
);
const title = mode === "diff" ? "Sample Diff Review" : "Add dark mode support";

const aiAnnotations: AiAnnotationsFile = JSON.parse(
  fs.readFileSync(ANNOTATIONS_PATH, "utf-8")
) as AiAnnotationsFile;

const { server: planServer, waitForSubmit } = createPlanServer(
  PLAN_PATH,
  "",
  title,
  "dark",
  mode,
  undefined,
  aiAnnotations
);
planServer.listen(PLAN_PORT, () => {
  console.log(`Plan API:  http://localhost:${PLAN_PORT}`);
});

// Log submit output to the terminal but keep servers running for continued iteration
void waitForSubmit().then(({ comments }) => {
  if (comments.length === 0) {
    console.log("\n[submit] No comments.");
  } else {
    console.log(`\n[submit] ${comments.length} comment(s):`);
    for (const c of comments) {
      const label =
        c.startLine === 0
          ? "General"
          : `line ${c.startLine === c.endLine ? String(c.startLine) : `${String(c.startLine)}–${String(c.endLine)}`}`;
      console.log(`  ${label}: ${c.text}`);
    }
  }
  console.log("\n[dev] Reload the page to review again.");
});

const vite = await createVite({
  root: path.join(root, "src/ui"),
  server: {
    port: UI_PORT,
    proxy: {
      "/plan": `http://localhost:${PLAN_PORT}`,
      "/submit": `http://localhost:${PLAN_PORT}`,
    },
  },
});

await vite.listen();
vite.printUrls();
