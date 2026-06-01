import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createServer } from "../server/server.js";
import { formatOutput } from "./format.js";
import getPort from "get-port";
import open from "open";
import { UI_HTML } from "./ui-html.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function run(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .usage("Usage: review-plan <command> [options]")
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
    .option("comments-only", {
      type: "boolean",
      default: false,
      describe: "Output only the comments summary, omitting the full plan/diff content",
    })
    .help()
    .parseAsync();

  const command = argv._[0] as string;
  const preferredPort = argv.port;
  const title = argv.title;
  const theme = argv.theme;

  let planPath: string;
  let tmpFile: string | null = null;
  let mode = "plan";

  if (command === "plan") {
    const fileArg = argv.file as string | undefined;
    if (fileArg) {
      planPath = path.resolve(fileArg);
      if (!fs.existsSync(planPath)) {
        process.stderr.write(`review-plan: file not found: ${planPath}\n`);
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
  } else {
    process.stderr.write(`review-plan: unknown command: ${command}\n`);
    process.exit(1);
  }

  const port = await getPort({ port: preferredPort });

  const uiHtml =
    UI_HTML ??
    `<!doctype html><html><body><p>UI not built — run <code>npm run build</code></p></body></html>`;

  const { server, waitForSubmit } = createServer(planPath, uiHtml, title, theme, mode);
  server.listen(port);

  const url = `http://localhost:${String(port)}`;
  process.stderr.write(`Opening ${url}\n`);

  try {
    await open(url);
  } catch {
    process.stderr.write(`Could not open browser automatically. Visit: ${url}\n`);
  }

  const planContent = fs.readFileSync(planPath, "utf-8");
  const comments = await waitForSubmit();

  server.close();
  if (tmpFile) fs.unlinkSync(tmpFile);

  if (comments.length === 0) {
    process.stderr.write("No comments — user had no concerns.\n");
    process.exit(0);
  }

  process.stdout.write(formatOutput(planContent, comments, argv["comments-only"]));
  process.exit(0);
}

run().catch((err: unknown) => {
  process.stderr.write(`review-plan: ${String(err)}\n`);
  process.exit(1);
});
