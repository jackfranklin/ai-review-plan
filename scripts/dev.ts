import { createServer as createVite } from "vite";
import { createServer as createPlanServer } from "../src/server/server.js";
import type { AiAnnotationsFile, PlanUpdatePayload } from "../src/server/server.js";
import { debounce } from "../src/cli/debounce.js";
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

const { server: planServer, broadcastUpdate, onReviewRound, onSessionEnd } = createPlanServer(
  PLAN_PATH,
  "",
  title,
  "dark",
  mode,
  undefined,
  aiAnnotations,
  { interactive: true }
);
planServer.listen(PLAN_PORT, () => {
  console.log(`Plan API:  http://localhost:${PLAN_PORT}`);
});

// Log each submit round to the terminal, but keep the servers running for continued
// iteration — this dev harness never exits based on a verdict.
onReviewRound(({ comments, verdict }) => {
  console.log(`\n[submit] verdict: ${verdict}`);
  if (comments.length === 0) {
    console.log("[submit] No comments.");
  } else {
    console.log(`[submit] ${comments.length} comment(s):`);
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

onSessionEnd(() => {
  console.log("\n[dev] Browser disconnected.");
});

// Re-broadcasts the fixture + annotations over SSE when either file is edited, so the
// interactive loop can be exercised by hand without going through the real CLI.
const broadcastLatest = debounce(() => {
  const payload: PlanUpdatePayload = { markdown: fs.readFileSync(PLAN_PATH, "utf-8") };
  const data = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, "utf-8")) as AiAnnotationsFile;
  if (data.summary) payload.aiSummary = data.summary;
  if (data.annotations?.length) payload.aiAnnotations = data.annotations;
  broadcastUpdate(payload);
}, 200);
fs.watch(PLAN_PATH, broadcastLatest);
fs.watch(ANNOTATIONS_PATH, broadcastLatest);

const vite = await createVite({
  root: path.join(root, "src/ui"),
  server: {
    port: UI_PORT,
    proxy: {
      "/plan": `http://localhost:${PLAN_PORT}`,
      "/submit": `http://localhost:${PLAN_PORT}`,
      "/events": `http://localhost:${PLAN_PORT}`,
    },
  },
});

await vite.listen();
vite.printUrls();
