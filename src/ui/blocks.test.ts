import { describe, it, expect } from "vitest";
import { groupBlocks, parseLineIndent, parseDiff, groupFilesByDirectory, computeGroupedBlocks, mapAnnotationsToBlocks } from "./blocks.js";
import type { Block } from "./blocks.js";
import type { AiAnnotation } from "./types.js";

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
    if (fence) {
      expect(fence.startLine).toBeLessThan(fence.endLine);
    }
  });

  it("groups a 4-space-indented fence", () => {
    const blocks = groupBlocks("    ```\n    code\n    ```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 3 });
  });

  it("uses longer fence as opening and requires same length to close", () => {
    const blocks = groupBlocks("````\ncode\n```\nstill inside\n````\nafter");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 5 });
  });

  it("groups a markdown table into a single block", () => {
    const blocks = groupBlocks("| Col 1 | Col 2 |\n|---|---|\n| val 1 | val 2 |");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      startLine: 1,
      endLine: 3,
      raw: "| Col 1 | Col 2 |\n|---|---|\n| val 1 | val 2 |"
    });
  });

  it("handles table delimiters with different alignment indicators", () => {
    const blocks = groupBlocks("| Col 1 | Col 2 |\n| :--- | :---: |\n| val 1 | val 2 |");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      startLine: 1,
      endLine: 3,
      raw: "| Col 1 | Col 2 |\n| :--- | :---: |\n| val 1 | val 2 |"
    });
  });

  it("terminates table grouping on blank lines or non-pipe lines", () => {
    const blocks = groupBlocks("| Col 1 |\n|---|\n| val 1 |\n\nparagraph");
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 3 });
    expect(blocks[1]).toMatchObject({ startLine: 4, endLine: 4, raw: "" });
    expect(blocks[2]).toMatchObject({ startLine: 5, endLine: 5, raw: "paragraph" });
  });

  it("does not group non-table lines with pipes and no delimiters", () => {
    const blocks = groupBlocks("this | that\nother | line");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ startLine: 1, endLine: 1 });
    expect(blocks[1]).toMatchObject({ startLine: 2, endLine: 2 });
  });
});

describe("parseLineIndent", () => {
  it("returns zero indent for non-indented lines", () => {
    const result = parseLineIndent("- item");
    expect(result).toEqual({ raw: "- item", indent: 0 });
  });

  it("returns indent and trimmed string for indented lines", () => {
    const result = parseLineIndent("    - item");
    expect(result).toEqual({ raw: "- item", indent: 4 });
  });

  it("trims fenced code blocks and returns their indent", () => {
    const result = parseLineIndent("  ```ts\n  code\n  ```");
    expect(result).toEqual({ raw: "```ts\ncode\n```", indent: 2 });
  });

  it("trims table blocks and returns their indent", () => {
    const result = parseLineIndent("  | Col 1 |\n  |---|\n  | val 1 |");
    expect(result).toEqual({
      raw: "| Col 1 |\n|---|\n| val 1 |",
      indent: 2
    });
  });

  it("handles lines with only spaces", () => {
    const result = parseLineIndent("   ");
    expect(result).toEqual({ raw: "", indent: 3 });
  });
});

describe("parseDiff", () => {
  it("parses file markers correctly", () => {
    const diff = "--- a/file.ts\n+++ b/file.ts\ncontent";
    const blocks = parseDiff(diff);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("file-header");
    expect(blocks[0].raw).toBe("file.ts");
    expect(blocks[1].raw).toBe("content");
  });

  it("parses hunk headers and tracks line numbers", () => {
    const diff = "@@ -10,2 +10,2 @@\n line 1\n-line 2\n+line 2 mod";
    const blocks = parseDiff(diff);
    expect(blocks).toHaveLength(4);
    expect(blocks[1]).toMatchObject({ raw: " line 1", oldLine: 10, newLine: 10 });
    expect(blocks[2]).toMatchObject({ raw: "-line 2", oldLine: 11 });
    expect(blocks[3]).toMatchObject({ raw: "+line 2 mod", newLine: 11 });
  });

  it("handles headers without line numbers", () => {
    const diff = "diff --git a/file.ts b/file.ts\nindex 123..456\n@@ -1,1 +1,1 @@\n content";
    const blocks = parseDiff(diff);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].oldLine).toBeUndefined();
    expect(blocks[1].oldLine).toBeUndefined();
    expect(blocks[3]).toMatchObject({ raw: " content", oldLine: 1, newLine: 1 });
  });

  it("handles new files with --- /dev/null header", () => {
    const diff = "--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1,2 @@\n+line one\n+line two";
    const blocks = parseDiff(diff);
    expect(blocks[0].type).toBe("file-header");
    expect(blocks[0].raw).toBe("src/new.ts");
    const addedLines = blocks.filter((b) => b.raw.startsWith("+"));
    expect(addedLines).toHaveLength(2);
    expect(addedLines[0]).toMatchObject({ newLine: 1 });
    expect(addedLines[1]).toMatchObject({ newLine: 2 });
  });

  it("does not treat +++ b/ as an added diff line when /dev/null is present", () => {
    const diff = "--- /dev/null\n+++ b/src/new.ts\n@@ -0,0 +1,1 @@\n+content";
    const blocks = parseDiff(diff);
    const plusPlusLines = blocks.filter((b) => b.raw.startsWith("+++ b/"));
    expect(plusPlusLines).toHaveLength(0);
  });

  it("correctly increments line numbers across blank context lines", () => {
    const diff = "@@ -5,4 +5,4 @@\n line 5\n \n line 7\n-old 8\n+new 8";
    const blocks = parseDiff(diff);
    // " " is a blank context line — should still advance counters
    const line7Block = blocks.find((b) => b.raw === " line 7");
    expect(line7Block).toMatchObject({ oldLine: 7, newLine: 7 });
    const oldLine8 = blocks.find((b) => b.raw === "-old 8");
    expect(oldLine8).toMatchObject({ oldLine: 8 });
    const newLine8 = blocks.find((b) => b.raw === "+new 8");
    expect(newLine8).toMatchObject({ newLine: 8 });
  });
});

describe("groupFilesByDirectory", () => {
  it("groups and sorts files by directory and filename alphabetically, placing root files at the bottom", () => {
    const files = [
      { name: "src/ui/components/rp-plan-line.ts", isDeleted: false },
      { name: "src/ui/components/rp-app.ts", isDeleted: false },
      { name: "tsconfig.json", isDeleted: false },
      { name: "src/ui/types.ts", isDeleted: true },
      { name: "src/ui/blocks.ts", isDeleted: false },
      { name: "package.json", isDeleted: false },
    ];

    const result = groupFilesByDirectory(files);

    expect(result).toHaveLength(3);

    // Group 1: src/ui
    expect(result[0]).toEqual({
      dirPath: "src/ui",
      files: [
        { name: "src/ui/blocks.ts", isDeleted: false, displayName: "blocks.ts" },
        { name: "src/ui/types.ts", isDeleted: true, displayName: "types.ts" },
      ],
    });

    // Group 2: src/ui/components
    expect(result[1]).toEqual({
      dirPath: "src/ui/components",
      files: [
        { name: "src/ui/components/rp-app.ts", isDeleted: false, displayName: "rp-app.ts" },
        { name: "src/ui/components/rp-plan-line.ts", isDeleted: false, displayName: "rp-plan-line.ts" },
      ],
    });

    // Group 3: Root level (empty dirPath)
    expect(result[2]).toEqual({
      dirPath: "",
      files: [
        { name: "package.json", isDeleted: false, displayName: "package.json" },
        { name: "tsconfig.json", isDeleted: false, displayName: "tsconfig.json" },
      ],
    });
  });
});

describe("computeGroupedBlocks", () => {
  const block = (fileName: string | undefined, startLine: number): Block => ({
    type: "diff-line",
    startLine,
    endLine: startLine,
    raw: "line",
    fileName,
  });

  it("returns a single group when all blocks share the same fileName", () => {
    const blocks = [block("src/a.ts", 1), block("src/a.ts", 2), block("src/a.ts", 3)];
    const groups = computeGroupedBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].fileName).toBe("src/a.ts");
    expect(groups[0].blocks).toHaveLength(3);
  });

  it("splits into separate groups when fileName changes", () => {
    const blocks = [block("src/a.ts", 1), block("src/b.ts", 2), block("src/b.ts", 3)];
    const groups = computeGroupedBlocks(blocks);
    expect(groups).toHaveLength(2);
    expect(groups[0].fileName).toBe("src/a.ts");
    expect(groups[1].fileName).toBe("src/b.ts");
    expect(groups[1].blocks).toHaveLength(2);
  });

  it("groups blocks with no fileName (plan mode content) together", () => {
    const blocks = [block(undefined, 1), block(undefined, 2)];
    const groups = computeGroupedBlocks(blocks);
    expect(groups).toHaveLength(1);
    expect(groups[0].fileName).toBeUndefined();
    expect(groups[0].blocks).toHaveLength(2);
  });

  it("marks a group as deleted when the first block has isDeleted set", () => {
    const deletedBlock: Block = { type: "file-header", startLine: 1, endLine: 1, raw: "src/a.ts", fileName: "src/a.ts", isDeleted: true };
    const groups = computeGroupedBlocks([deletedBlock]);
    expect(groups[0].isDeleted).toBe(true);
  });

  it("returns an empty array for empty input", () => {
    expect(computeGroupedBlocks([])).toEqual([]);
  });
});

describe("mapAnnotationsToBlocks", () => {
  describe("plan mode", () => {
    it("maps an annotation to the block whose range contains startLine", () => {
      const blocks = groupBlocks("# Title\n```\ncode\n```\nafter");
      const annotation: AiAnnotation = { startLine: 2, endLine: 4, text: "code block" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "plan");
      expect(map.get(2)).toEqual([annotation]);
    });

    it("maps an annotation whose startLine falls on a single-line block", () => {
      const blocks = groupBlocks("line1\nline2\nline3");
      const annotation: AiAnnotation = { startLine: 1, endLine: 2, text: "spans two lines" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "plan");
      expect(map.get(1)).toEqual([annotation]);
    });

    it("falls back to the next block when startLine falls between blocks", () => {
      // Manually build blocks with a gap at line 2 to force the fallback path
      const blocks: Block[] = [
        { type: "content", startLine: 1, endLine: 1, raw: "line1" },
        { type: "content", startLine: 3, endLine: 3, raw: "line3" },
      ];
      const annotation: AiAnnotation = { startLine: 2, endLine: 2, text: "in the gap" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "plan");
      expect(map.get(3)).toEqual([annotation]);
    });

    it("returns an empty map when no block matches", () => {
      const blocks = groupBlocks("line1");
      const annotation: AiAnnotation = { startLine: 99, endLine: 99, text: "out of range" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "plan");
      expect(map.size).toBe(0);
    });

    it("accumulates multiple annotations on the same block", () => {
      const blocks = groupBlocks("# Title\nsome text");
      const a1: AiAnnotation = { startLine: 1, endLine: 1, text: "first" };
      const a2: AiAnnotation = { startLine: 1, endLine: 1, text: "second" };
      const map = mapAnnotationsToBlocks([a1, a2], blocks, "plan");
      expect(map.get(1)).toEqual([a1, a2]);
    });
  });

  describe("diff mode", () => {
    const diffText = [
      "diff --git a/src/foo.ts b/src/foo.ts",
      "index 000..111 100644",
      "--- a/src/foo.ts",
      "+++ b/src/foo.ts",
      "@@ -38,3 +38,3 @@",
      " context line",
      "-old line",
      "+new line",
    ].join("\n");

    it("maps an old-line annotation to the deleted block", () => {
      const blocks = parseDiff(diffText);
      const annotation: AiAnnotation = { file: "src/foo.ts", startLine: 39, endLine: 39, lineType: "old", text: "changed here" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "diff");
      const matchedBlock = blocks.find(b => b.fileName === "src/foo.ts" && b.oldLine === 39);
      expect(matchedBlock).toBeDefined();
      expect(map.get(matchedBlock!.startLine)).toEqual([annotation]);
    });

    it("maps a new-line annotation to the added block", () => {
      const blocks = parseDiff(diffText);
      const annotation: AiAnnotation = { file: "src/foo.ts", startLine: 39, endLine: 39, lineType: "new", text: "new line here" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "diff");
      const matchedBlock = blocks.find(b => b.fileName === "src/foo.ts" && b.newLine === 39);
      expect(matchedBlock).toBeDefined();
      expect(map.get(matchedBlock!.startLine)).toEqual([annotation]);
    });

    it("ignores annotations for files not in the diff", () => {
      const blocks = parseDiff(diffText);
      const annotation: AiAnnotation = { file: "src/bar.ts", startLine: 1, endLine: 1, text: "missing file" };
      const map = mapAnnotationsToBlocks([annotation], blocks, "diff");
      expect(map.size).toBe(0);
    });
  });
});
