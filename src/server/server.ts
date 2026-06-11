import http from "node:http";
import fs from "node:fs";

export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export type Verdict = "approve" | "reject";

export interface ReviewResult {
  comments: Comment[];
  verdict: Verdict;
}

export function createServer(
  planPath: string,
  uiHtml: string,
  title = "",
  theme = "dark",
  mode = "plan"
): { server: http.Server; waitForSubmit: () => Promise<ReviewResult> } {
  let resolveSubmit!: (result: ReviewResult) => void;
  const submitPromise = new Promise<ReviewResult>((resolve) => {
    resolveSubmit = resolve;
  });

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(uiHtml);
      return;
    }

    if (req.method === "GET" && req.url === "/plan") {
      const markdown = fs.readFileSync(planPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ markdown, title, theme, mode }));
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        const { comments, verdict } = JSON.parse(body) as { comments: Comment[]; verdict: Verdict };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        resolveSubmit({ comments, verdict });
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return { server, waitForSubmit: () => submitPromise };
}
