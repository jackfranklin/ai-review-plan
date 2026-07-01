import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, __setDisconnectGraceMsForTests } from "./server.js";

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
    __setDisconnectGraceMsForTests(30_000);
  });

  it("fires onSessionEnd after the grace period once all clients disconnect", async () => {
    __setDisconnectGraceMsForTests(30);
    planFile = tmpPlanFile();
    const { server, onSessionEnd } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
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
    __setDisconnectGraceMsForTests(50);
    planFile = tmpPlanFile();
    const { server, onSessionEnd } = createServer(planFile, "<html></html>", "", "dark", "plan", undefined, undefined, { interactive: true });
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
