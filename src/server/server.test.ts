import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer } from "./server.js";

function tmpPlanFile(content = "# Plan\n"): string {
  const file = path.join(os.tmpdir(), `server-test-${String(Date.now())}-${String(Math.random())}.md`);
  fs.writeFileSync(file, content);
  return file;
}

// Undici keeps cancelled/aborted client connections pooled for its own
// keep-alive timeout, which otherwise makes server.close() wait several
// seconds for the socket to actually go away.
function closeServer(server: import("node:http").Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => { server.close(() => { resolve(); }); });
}

describe("createServer interactive /events", () => {
  let planFile: string;

  afterEach(() => {
    if (planFile) fs.rmSync(planFile, { force: true });
  });

  it("returns an SSE content-type on /events", async () => {
    planFile = tmpPlanFile();
    const { server } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const controller = new AbortController();
    const res = await fetch(`http://localhost:${String(port)}/events`, { signal: controller.signal });
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    controller.abort();
    await closeServer(server);
  });

  it("broadcastUpdate writes to connected SSE clients", async () => {
    planFile = tmpPlanFile();
    const { server, broadcastUpdate } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const controller = new AbortController();
    const res = await fetch(`http://localhost:${String(port)}/events`, { signal: controller.signal });
    if (!res.body) throw new Error("expected a response body");
    const reader = res.body.getReader();

    // Consume the initial keep-alive newline written when the connection opens.
    await reader.read();

    broadcastUpdate({ markdown: "# Updated\n" });

    const { value } = await reader.read();
    if (!value) throw new Error("expected a broadcast chunk");
    const chunk = Buffer.from(value).toString("utf-8");
    expect(chunk).toContain("data: ");
    expect(chunk).toContain("Updated");

    controller.abort();
    await closeServer(server);
  });
});

describe("createServer disconnect grace timer", () => {
  let planFile: string;

  afterEach(() => {
    if (planFile) fs.rmSync(planFile, { force: true });
  });

  it("fires onSessionEnd after the grace period once all clients disconnect", async () => {
    planFile = tmpPlanFile();
    const { server, onSessionEnd } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true, disconnectGraceMs: 30 });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const reasons: string[] = [];
    onSessionEnd((reason) => reasons.push(reason));

    const res = await fetch(`http://localhost:${String(port)}/events`);
    await res.body?.cancel();

    expect(reasons).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(reasons).toEqual(["disconnected"]);

    await closeServer(server);
  });

  it("cancels the grace timer if a client reconnects in time", async () => {
    planFile = tmpPlanFile();
    const { server, onSessionEnd } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true, disconnectGraceMs: 50 });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const reasons: string[] = [];
    onSessionEnd((reason) => reasons.push(reason));

    const first = await fetch(`http://localhost:${String(port)}/events`);
    await first.body?.cancel();

    // Reconnect well before the (short, test-only) grace period elapses.
    const second = await fetch(`http://localhost:${String(port)}/events`);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(reasons).toEqual([]);

    await second.body?.cancel();
    await closeServer(server);
  });
});

describe("createServer /submit", () => {
  let planFile: string;

  afterEach(() => {
    if (planFile) fs.rmSync(planFile, { force: true });
  });

  it("non-interactive: resolves waitForSubmit and responds { ok: true } regardless of verdict", async () => {
    planFile = tmpPlanFile();
    const { server, waitForSubmit } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const resultPromise = waitForSubmit();
    const res = await fetch(`http://localhost:${String(port)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: [], verdict: "reject" }),
    });
    const body = await res.json() as { ok?: boolean };
    expect(body).toEqual({ ok: true });
    expect(await resultPromise).toEqual({ comments: [], verdict: "reject" });

    await closeServer(server);
  });

  it("interactive: reject invokes onReviewRound, responds waiting_for_updates, and keeps the server alive", async () => {
    planFile = tmpPlanFile();
    const { server, onReviewRound } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const rounds: unknown[] = [];
    onReviewRound((result) => rounds.push(result));

    const res = await fetch(`http://localhost:${String(port)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: [{ startLine: 1, endLine: 1, text: "fix this" }], verdict: "reject" }),
    });
    const body = await res.json() as { status?: string };
    expect(body).toEqual({ status: "waiting_for_updates" });
    expect(rounds).toEqual([{ comments: [{ startLine: 1, endLine: 1, text: "fix this" }], verdict: "reject" }]);

    // The server should still be listening for further requests.
    const res2 = await fetch(`http://localhost:${String(port)}/plan`);
    expect(res2.status).toBe(200);

    await closeServer(server);
  });

  it("interactive: approve invokes onReviewRound, resolves waitForSubmit, and responds closing", async () => {
    planFile = tmpPlanFile();
    const { server, onReviewRound, waitForSubmit } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const rounds: unknown[] = [];
    onReviewRound((result) => rounds.push(result));
    const resultPromise = waitForSubmit();

    const res = await fetch(`http://localhost:${String(port)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: [], verdict: "approve" }),
    });
    const body = await res.json() as { status?: string };
    expect(body).toEqual({ status: "closing" });
    expect(rounds).toEqual([{ comments: [], verdict: "approve" }]);
    expect(await resultPromise).toEqual({ comments: [], verdict: "approve" });

    await closeServer(server);
  });
});
