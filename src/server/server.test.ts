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
    await new Promise<void>((resolve) => { server.close(() => { resolve(); }); });
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
    await new Promise<void>((resolve) => { server.close(() => { resolve(); }); });
  });
});
