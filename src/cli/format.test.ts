import { describe, it, expect } from "vitest";
import { formatOutput } from "./format.js";

describe("formatOutput", () => {
  it("leads with the verdict heading", () => {
    const result = formatOutput("# Plan\n\nStep 1", [], "approve");
    expect(result).toContain("## Review: APPROVED");
  });

  it("uses CHANGES REQUESTED heading for reject verdict", () => {
    const result = formatOutput("# Plan", [], "reject");
    expect(result).toContain("## Review: CHANGES REQUESTED");
  });

  it("says no inline comments when there are none", () => {
    const result = formatOutput("# Plan", [], "approve");
    expect(result).toContain("No inline comments.");
  });

  it("lists inline comments as a numbered list sorted by line", () => {
    const result = formatOutput("A\nB\nC", [
      { startLine: 3, endLine: 3, text: "Third" },
      { startLine: 1, endLine: 1, text: "First" },
    ], "approve");
    expect(result).toContain("1. **Line 1** — First");
    expect(result).toContain("2. **Line 3** — Third");
    expect(result.indexOf("Line 1")).toBeLessThan(result.indexOf("Line 3"));
  });

  it("formats multi-line comment range with en-dash", () => {
    const result = formatOutput("A\nB\nC", [
      { startLine: 1, endLine: 3, text: "Whole section" },
    ], "approve");
    expect(result).toContain("1. **Lines 1–3** — Whole section");
  });

  it("includes comment count in the section heading", () => {
    const result = formatOutput("A\nB", [
      { startLine: 1, endLine: 1, text: "One" },
      { startLine: 2, endLine: 2, text: "Two" },
    ], "approve");
    expect(result).toContain("### Comments (2)");
  });

  it("renders general comment (startLine 0) as prose above the inline list", () => {
    const result = formatOutput("A\nB", [
      { startLine: 0, endLine: 0, text: "Overall looks good" },
      { startLine: 1, endLine: 1, text: "Fix this" },
    ], "reject");
    expect(result).toContain("Overall looks good");
    expect(result.indexOf("Overall looks good")).toBeLessThan(result.indexOf("Fix this"));
    expect(result).not.toContain("Line 0");
  });

  it("does not include annotated plan by default", () => {
    const result = formatOutput("Line 1\nLine 2", [
      { startLine: 1, endLine: 1, text: "Fix" },
    ], "approve");
    expect(result).not.toContain("### Annotated Plan");
    expect(result).not.toContain("Line 1\n");
  });

  it("includes annotated plan when includePlan is true", () => {
    const result = formatOutput("Line 1\nLine 2", [
      { startLine: 1, endLine: 1, text: "Fix" },
    ], "approve", true);
    expect(result).toContain("### Annotated Plan");
    expect(result).toContain("> **Comment (line 1):** Fix");
  });
});
