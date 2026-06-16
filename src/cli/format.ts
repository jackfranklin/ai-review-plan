import type { Comment, Verdict } from "../server/server.js";

export function formatOutput(
  content: string,
  comments: Comment[],
  verdict: Verdict,
  includePlan = false
): string {
  const verdictHeading = verdict === "approve" ? "APPROVED" : "CHANGES REQUESTED";
  const lines: string[] = [`## Review: ${verdictHeading}`, ""];

  const general = comments.filter((c) => c.startLine === 0);
  const inline = comments.filter((c) => c.startLine !== 0);

  if (general.length > 0) {
    for (const c of general) {
      lines.push(c.text, "");
    }
  }

  if (inline.length === 0) {
    lines.push("No inline comments.");
  } else {
    lines.push(`### Comments (${String(inline.length)})`, "");
    const sorted = [...inline].sort((a, b) => a.startLine - b.startLine);
    for (const [i, c] of sorted.entries()) {
      const loc =
        c.startLine === c.endLine
          ? `Line ${String(c.startLine)}`
          : `Lines ${String(c.startLine)}–${String(c.endLine)}`;
      lines.push(`${String(i + 1)}. **${loc}** — ${c.text}`);
    }
  }

  if (includePlan) {
    lines.push("", "### Annotated Plan", "");
    const planLines = content.split("\n");
    const commentsByLine = new Map<number, Comment[]>();
    for (const c of inline) {
      const existing = commentsByLine.get(c.startLine) ?? [];
      existing.push(c);
      commentsByLine.set(c.startLine, existing);
    }
    for (let i = 0; i < planLines.length; i++) {
      lines.push(planLines[i]);
      const lineComments = commentsByLine.get(i + 1);
      if (lineComments) {
        for (const c of lineComments) {
          const label =
            c.startLine === c.endLine
              ? `line ${String(c.startLine)}`
              : `lines ${String(c.startLine)}–${String(c.endLine)}`;
          lines.push(`> **Comment (${label}):** ${c.text}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}
