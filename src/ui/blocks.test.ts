import { describe, it, expect } from "vitest";
import { groupBlocks } from "./blocks.js";

describe("groupBlocks", () => {
  it("returns one block per line for plain content", () => {
    const blocks = groupBlocks("# Title\n\nParagraph");
    expect(blocks).toHaveLength(3);
    blocks.forEach((b, i) => {
      expect(b.startLine).toBe(i + 1);
      expect(b.endLine).toBe(i + 1);
    });
  });

  it("groups a backtick fenced code block into a single block", () => {
    const blocks = groupBlocks("before\n```\ncode\n```\nafter");
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toMatchObject({ startLine: 2, endLine: 4, raw: "```\ncode\n```" });
  });

  it("groups a tilde fenced code block", () => {
    const blocks = groupBlocks("~~~\ncode\n~~~");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 3 });
  });

  it("handles fences indented up to 3 spaces", () => {
    const blocks = groupBlocks("- item\n   ```\n   code\n   ```\ntext");
    const fence = blocks.find(b => b.raw.includes("code"));
    expect(fence).toBeDefined();
    expect(fence!.startLine).toBeLessThan(fence!.endLine);
  });

  it("treats a 4-space-indented line as a plain block, not a fence", () => {
    const blocks = groupBlocks("    ```\nline");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].startLine).toBe(blocks[0].endLine);
  });

  it("uses longer fence as opening and requires same length to close", () => {
    const blocks = groupBlocks("````\ncode\n```\nstill inside\n````\nafter");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 5 });
  });
});
