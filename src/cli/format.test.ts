import { describe, it, expect } from "vitest";
import { formatOutput } from "./format.js";

describe("formatOutput", () => {
  it("includes the output header and section headings", () => {
    const result = formatOutput("# Plan\n\nStep 1", []);
    expect(result).toContain("<!-- ai-review output -->");
    expect(result).toContain("## Annotated Plan");
    expect(result).toContain("## Comment Summary");
  });

  it("interleaves a single-line comment after the target line", () => {
    const result = formatOutput("Line 1\nLine 2\nLine 3", [
      { startLine: 2, endLine: 2, text: "Needs detail" },
    ]);
    expect(result).toContain("> **Comment (line 2):** Needs detail");
    expect(result).toContain("| 2 | Needs detail |");
  });

  it("formats a multi-line comment range with en-dash", () => {
    const result = formatOutput("Line 1\nLine 2\nLine 3", [
      { startLine: 1, endLine: 3, text: "Whole section" },
    ]);
    expect(result).toContain("> **Comment (lines 1–3):** Whole section");
    expect(result).toContain("| 1–3 | Whole section |");
  });

  it("sorts comments by startLine in the summary table", () => {
    const result = formatOutput("A\nB\nC", [
      { startLine: 3, endLine: 3, text: "Third" },
      { startLine: 1, endLine: 1, text: "First" },
    ]);
    expect(result.indexOf("| 1 | First |")).toBeLessThan(result.indexOf("| 3 | Third |"));
  });

  it("returns empty comment table when no comments provided", () => {
    const result = formatOutput("# Plan", []);
    expect(result).toContain("|-------|---------|");
    const lines = result.split("\n");
    const separatorIdx = lines.findIndex(l => l === "|-------|---------|");
    expect(lines[separatorIdx + 1]).toBe("");
  });
  it("omits the annotated plan when diffOnly is true", () => {
    const result = formatOutput("Line 1\nLine 2", [
      { startLine: 1, endLine: 1, text: "Needs detail" },
    ], true);
    expect(result).toContain("<!-- ai-review output -->");
    expect(result).not.toContain("## Annotated Plan");
    expect(result).not.toContain("Line 1");
    expect(result).toContain("## Comment Summary");
    expect(result).toContain("| 1 | Needs detail |");
  });

  it("formats general comments in a dedicated section and excludes them from summary table/inline comments", () => {
    const result = formatOutput("Line 1\nLine 2", [
      { startLine: 0, endLine: 0, text: "Overall good plan" },
      { startLine: 1, endLine: 1, text: "Needs detail" },
    ]);
    expect(result).toContain("## General Comments\n\n- Overall good plan\n");
    expect(result).toContain("> **Comment (line 1):** Needs detail");
    expect(result).not.toContain("> **Comment (line 0):** Overall good plan");
    expect(result).toContain("| 1 | Needs detail |");
    expect(result).not.toContain("| 0 | Overall good plan |");
  });
});
