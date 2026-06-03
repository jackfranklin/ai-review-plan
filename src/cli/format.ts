import type { Comment } from "../server/server.js";

export function formatOutput(content: string, comments: Comment[], diffOnly = false): string {
  const annotated: string[] = ["<!-- review-plan output -->", ""];

  const general = comments.filter((c) => c.startLine === 0);
  const lineSpecific = comments.filter((c) => c.startLine !== 0);

  if (general.length > 0) {
    annotated.push("## General Comments", "");
    for (const c of general) {
      annotated.push(`- ${c.text}`);
    }
    annotated.push("");
  }

  if (!diffOnly) {
    const lines = content.split("\n");
    const commentsByLine = new Map<number, Comment[]>();
    for (const c of lineSpecific) {
      const existing = commentsByLine.get(c.startLine) ?? [];
      existing.push(c);
      commentsByLine.set(c.startLine, existing);
    }

    annotated.push("## Annotated Plan", "");

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      annotated.push(lines[i]);
      const lineComments = commentsByLine.get(lineNum);
      if (lineComments) {
        for (const c of lineComments) {
          const label =
            c.startLine === c.endLine
              ? `line ${String(c.startLine)}`
              : `lines ${String(c.startLine)}–${String(c.endLine)}`;
          annotated.push(`> **Comment (${label}):** ${c.text}`);
        }
      }
    }
    annotated.push("");
  }

  annotated.push("## Comment Summary", "");
  annotated.push("| Lines | Comment |");
  annotated.push("|-------|---------|");

  const sorted = [...lineSpecific].sort((a, b) => a.startLine - b.startLine);
  for (const c of sorted) {
    const label =
      c.startLine === c.endLine ? String(c.startLine) : `${String(c.startLine)}–${String(c.endLine)}`;
    annotated.push(`| ${label} | ${c.text} |`);
  }

  return annotated.join("\n") + "\n";
}
