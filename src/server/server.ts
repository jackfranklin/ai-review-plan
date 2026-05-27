import http from "node:http";
import fs from "node:fs";

export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export function createServer(
  planPath: string,
  uiHtml: string,
  title = ""
): { server: http.Server; waitForSubmit: () => Promise<Comment[]> } {
  let resolveSubmit!: (comments: Comment[]) => void;
  const submitPromise = new Promise<Comment[]>((resolve) => {
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
      res.end(JSON.stringify({ markdown, title }));
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        const { comments } = JSON.parse(body) as { comments: Comment[] };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        resolveSubmit(comments);
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  return { server, waitForSubmit: () => submitPromise };
}
