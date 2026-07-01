import http from "node:http";
import fs from "node:fs";
import type { AiAnnotationsFile } from "../types/annotation.js";

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

export type { AiAnnotation, AiAnnotationsFile } from "../types/annotation.js";

export function createServer(
  planPath: string,
  uiHtml: string,
  title = "",
  theme = "dark",
  mode = "plan",
  wrap?: boolean,
  aiAnnotations?: AiAnnotationsFile
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
      const payload: Record<string, unknown> = { markdown, title, theme, mode, wrap };
      if (aiAnnotations?.summary) payload.aiSummary = aiAnnotations.summary;
      if (aiAnnotations?.annotations?.length) payload.aiAnnotations = aiAnnotations.annotations;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const { comments, verdict } = JSON.parse(body) as { comments: Comment[]; verdict: Verdict };
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          resolveSubmit({ comments, verdict });
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return { server, waitForSubmit: () => submitPromise };
}
