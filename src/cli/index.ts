import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/server.js";
import type { Comment } from "../server/server.js";
import getPort from "get-port";
import open from "open";
import { UI_HTML } from "./ui-html.js";

const DEFAULT_PORT = 7777;

function parseArgs(): { file: string | null; port: number } {
  const args = process.argv.slice(2);
  let file: string | null = null;
  let port = DEFAULT_PORT;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (!args[i].startsWith("-")) {
      file = args[i];
    }
  }
  return { file, port };
}

async function run(): Promise<void> {
  const { file: fileArg, port: preferredPort } = parseArgs();

  let planPath: string;
  let tmpFile: string | null = null;

  if (fileArg) {
    planPath = path.resolve(fileArg);
    if (!fs.existsSync(planPath)) {
      process.stderr.write(`review-plan: file not found: ${planPath}\n`);
      process.exit(1);
    }
  } else {
    const content = fs.readFileSync(process.stdin.fd, "utf-8");
    tmpFile = path.join(os.tmpdir(), `plan-review-${Date.now()}.md`);
    fs.writeFileSync(tmpFile, content);
    planPath = tmpFile;
  }

  const port = await getPort({ port: preferredPort });

  const uiHtml =
    UI_HTML ??
    `<!doctype html><html><body><p>UI not built — run <code>npm run build</code></p></body></html>`;

  const { server, waitForSubmit } = createServer(planPath, uiHtml);
  server.listen(port);

  const url = `http://localhost:${port}`;
  process.stderr.write(`Opening ${url}\n`);

  try {
    await open(url);
  } catch {
    process.stderr.write(`Could not open browser automatically. Visit: ${url}\n`);
  }

  const comments = await waitForSubmit();

  server.close();
  if (tmpFile) fs.unlinkSync(tmpFile);

  if (comments.length === 0) {
    process.stderr.write("No comments — user had no concerns.\n");
    process.exit(0);
  }

  process.stdout.write(formatOutput(planPath, comments));
  process.exit(0);
}

function formatOutput(planPath: string, comments: Comment[]): string {
  const lines = fs.readFileSync(planPath, "utf-8").split("\n");

  const commentsByLine = new Map<number, Comment[]>();
  for (const c of comments) {
    const existing = commentsByLine.get(c.startLine) ?? [];
    existing.push(c);
    commentsByLine.set(c.startLine, existing);
  }

  const annotated: string[] = ["<!-- review-plan output -->", "", "## Annotated Plan", ""];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    annotated.push(lines[i]);
    const lineComments = commentsByLine.get(lineNum);
    if (lineComments) {
      for (const c of lineComments) {
        const label =
          c.startLine === c.endLine
            ? `line ${c.startLine}`
            : `lines ${c.startLine}–${c.endLine}`;
        annotated.push(`> **Comment (${label}):** ${c.text}`);
      }
    }
  }

  annotated.push("", "## Comment Summary", "");
  annotated.push("| Lines | Comment |");
  annotated.push("|-------|---------|");

  const sorted = [...comments].sort((a, b) => a.startLine - b.startLine);
  for (const c of sorted) {
    const label =
      c.startLine === c.endLine ? `${c.startLine}` : `${c.startLine}–${c.endLine}`;
    annotated.push(`| ${label} | ${c.text} |`);
  }

  return annotated.join("\n") + "\n";
}

run().catch((err: unknown) => {
  process.stderr.write(`review-plan: ${String(err)}\n`);
  process.exit(1);
});
