import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/server.js";
import type { AiAnnotationsFile } from "../server/server.js";
import { formatOutput } from "./format.js";
import getPort from "get-port";
import open from "open";
import { UI_HTML } from "./ui-html.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function run(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: ai-review <command> [options]")
    .command("plan [file]", "Review a markdown plan", (yargs) => {
      return yargs.positional("file", {
        describe: "Plan markdown file (reads stdin if omitted)",
        type: "string",
      });
    })
    .command("diff", "Review a git diff", (yargs) => {
      return yargs;
    })
    .demandCommand(1, "You must specify a command")
    .option("port", {
      alias: "p",
      type: "number",
      default: 7777,
      describe: "Port for the local server (default: 7777)",
    })
    .option("title", {
      alias: "t",
      type: "string",
      default: "",
      describe: "Title shown in the review UI",
    })
    .option("theme", {
      choices: ["dark", "light"] as const,
      default: "dark" as const,
      describe: "Initial colour theme for the review UI",
    })
    .option("wrap", {
      type: "boolean",
      describe: "Line wrapping mode in UI (default: true)",
    })
    .option("include-plan", {
      type: "boolean",
      default: false,
      describe: "Include the full annotated plan/diff in the output (comments-only by default)",
    })
    .option("ai-annotations-file", {
      type: "string",
      describe: "Path to JSON file with AI annotations ({ summary?, annotations? })",
    })
    .option("interactive", {
      alias: "i",
      type: "boolean",
      default: false,
      describe: "Keep the server running and stream plan updates as an AI agent revises the file",
    })
    .help()
    .parseAsync();

  const command = argv._[0] as string;
  const preferredPort = argv.port;
  const title = argv.title;
  const theme = argv.theme;
  const wrap = argv.wrap;
  const interactive = argv.interactive;

  if (interactive && (command === "diff" || !argv.file)) {
    process.stderr.write(
      "ai-review: --interactive requires a plan file argument (an AI agent needs a real file to revise); it cannot be combined with stdin input.\n"
    );
    process.exit(1);
  }

  let planPath = "";
  let tmpFile: string | null = null;
  let mode = "plan";

  if (command === "plan") {
    const fileArg = argv.file as string | undefined;
    if (fileArg) {
      planPath = path.resolve(fileArg);
      if (!fs.existsSync(planPath)) {
        process.stderr.write(`ai-review: file not found: ${planPath}\n`);
        process.exit(1);
      }
    } else {
      const content = fs.readFileSync(process.stdin.fd, "utf-8");
      tmpFile = path.join(os.tmpdir(), `plan-review-${String(Date.now())}.md`);
      fs.writeFileSync(tmpFile, content);
      planPath = tmpFile;
    }
  } else if (command === "diff") {
    mode = "diff";
    const content = fs.readFileSync(process.stdin.fd, "utf-8");
    tmpFile = path.join(os.tmpdir(), `plan-review-${String(Date.now())}.diff`);
    fs.writeFileSync(tmpFile, content);
    planPath = tmpFile;
  }

  let aiAnnotationsData: AiAnnotationsFile | undefined;
  const annotationsFile = argv["ai-annotations-file"];
  if (annotationsFile) {
    if (!fs.existsSync(annotationsFile)) {
      process.stderr.write(`ai-review: ai-annotations-file not found: ${annotationsFile}\n`);
      process.exit(1);
    }
    try {
      aiAnnotationsData = JSON.parse(fs.readFileSync(annotationsFile, "utf-8")) as AiAnnotationsFile;
    } catch (err) {
      process.stderr.write(`ai-review: failed to parse ai-annotations-file: ${String(err)}\n`);
      process.exit(1);
    }
  }

  const port = await getPort({ port: preferredPort });

  const uiHtml =
    UI_HTML ??
    `<!doctype html><html><body><p>UI not built — run <code>npm run build</code></p></body></html>`;

  const { server, waitForSubmit } = createServer(planPath, uiHtml, title, theme, mode, wrap, aiAnnotationsData);
  server.listen(port);

  const url = `http://localhost:${String(port)}`;
  process.stderr.write(`Opening ${url}\n`);

  try {
    await open(url);
  } catch {
    process.stderr.write(`Could not open browser automatically. Visit: ${url}\n`);
  }

  const planContent = fs.readFileSync(planPath, "utf-8");
  let comments, verdict;
  try {
    ({ comments, verdict } = await waitForSubmit());
  } finally {
    server.close();
    if (tmpFile) fs.unlinkSync(tmpFile);
  }

  process.stdout.write(formatOutput(planContent, comments, verdict, argv["include-plan"]));
  process.exit(verdict === "approve" ? 0 : 1);
}

run().catch((err: unknown) => {
  process.stderr.write(`ai-review: ${String(err)}\n`);
  process.exit(1);
});
