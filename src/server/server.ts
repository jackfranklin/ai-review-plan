import http from "node:http";
import fs from "node:fs";
import type { AiAnnotationsFile } from "../types/annotation.js";
import type { PlanUpdatePayload } from "../types/interactive.js";

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
export type { PlanUpdatePayload, SubmitStatus } from "../types/interactive.js";

export interface CreateServerOptions {
  interactive?: boolean;
}

export interface ServerHandle {
  server: http.Server;
  waitForSubmit: () => Promise<ReviewResult>;
}

export type SessionEndReason = "disconnected";

export interface InteractiveServerHandle extends ServerHandle {
  broadcastUpdate: (payload: PlanUpdatePayload) => void;
  onSessionEnd: (cb: (reason: SessionEndReason) => void) => void;
  onReviewRound: (cb: (result: ReviewResult) => void) => void;
}

let disconnectGraceMs = 30_000;

/** Test-only hook to avoid waiting out the real grace period in tests. */
export function __setDisconnectGraceMsForTests(ms: number): void {
  disconnectGraceMs = ms;
}

export function createServer(
  planPath: string,
  uiHtml: string,
  title: string | undefined,
  theme: string | undefined,
  mode: string | undefined,
  wrap: boolean | undefined,
  aiAnnotations: AiAnnotationsFile | undefined,
  opts: { interactive: true }
): InteractiveServerHandle;
export function createServer(
  planPath: string,
  uiHtml: string,
  title?: string,
  theme?: string,
  mode?: string,
  wrap?: boolean,
  aiAnnotations?: AiAnnotationsFile,
  opts?: { interactive?: false }
): ServerHandle;
export function createServer(
  planPath: string,
  uiHtml: string,
  title = "",
  theme = "dark",
  mode = "plan",
  wrap?: boolean,
  aiAnnotations?: AiAnnotationsFile,
  opts?: CreateServerOptions
): ServerHandle | InteractiveServerHandle {
  const interactive = !!opts?.interactive;
  const sseConnections = new Set<http.ServerResponse>();
  const sessionEndCallbacks: Array<(reason: SessionEndReason) => void> = [];
  const reviewRoundCallbacks: Array<(result: ReviewResult) => void> = [];
  let disconnectGraceTimer: NodeJS.Timeout | null = null;

  let resolveSubmit!: (result: ReviewResult) => void;
  const submitPromise = new Promise<ReviewResult>((resolve) => {
    resolveSubmit = resolve;
  });

  function broadcastUpdate(payload: PlanUpdatePayload): void {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseConnections) res.write(data);
  }

  function onSessionEnd(cb: (reason: SessionEndReason) => void): void {
    sessionEndCallbacks.push(cb);
  }

  function onReviewRound(cb: (result: ReviewResult) => void): void {
    reviewRoundCallbacks.push(cb);
  }

  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(uiHtml);
      return;
    }

    if (req.method === "GET" && req.url === "/plan") {
      const markdown = fs.readFileSync(planPath, "utf-8");
      const payload: Record<string, unknown> = { markdown, title, theme, mode, wrap, interactive };
      if (aiAnnotations?.summary) payload.aiSummary = aiAnnotations.summary;
      if (aiAnnotations?.annotations?.length) payload.aiAnnotations = aiAnnotations.annotations;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === "GET" && req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      res.write("\n");
      sseConnections.add(res);
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
      }
      req.on("close", () => {
        sseConnections.delete(res);
        if (interactive && sseConnections.size === 0) {
          disconnectGraceTimer = setTimeout(() => {
            for (const cb of sessionEndCallbacks) cb("disconnected");
          }, disconnectGraceMs);
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/submit") {
      let body = "";
      req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      req.on("end", () => {
        try {
          const result = JSON.parse(body) as ReviewResult;
          if (!interactive) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
            resolveSubmit(result);
            return;
          }

          for (const cb of reviewRoundCallbacks) cb(result);
          if (result.verdict === "approve") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "closing" }));
            resolveSubmit(result);
          } else {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "waiting_for_updates" }));
          }
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

  const handle: ServerHandle = { server, waitForSubmit: () => submitPromise };
  if (!interactive) return handle;
  return { ...handle, broadcastUpdate, onSessionEnd, onReviewRound };
}
