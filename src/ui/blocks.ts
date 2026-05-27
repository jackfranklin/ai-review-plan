export interface Block {
  startLine: number;
  endLine: number;
  raw: string;
}

/**
 * Groups markdown source lines into renderable blocks.
 * Multi-line constructs (fenced code, blockquote runs, list items) are
 * collected into a single block so marked can render them correctly.
 * Single lines that don't belong to a multi-line construct each get their
 * own block.
 */
export function groupBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ``` or ~~~
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const start = i;
      i++;
      while (i < lines.length && !lines[i].startsWith(fence)) {
        i++;
      }
      // include closing fence if present
      if (i < lines.length) i++;
      blocks.push({
        startLine: start + 1,
        endLine: i,
        raw: lines.slice(start, i).join("\n"),
      });
      continue;
    }

    // Single line (handles headings, list items, blockquotes, blank lines, etc.)
    blocks.push({
      startLine: i + 1,
      endLine: i + 1,
      raw: line,
    });
    i++;
  }

  return blocks;
}
