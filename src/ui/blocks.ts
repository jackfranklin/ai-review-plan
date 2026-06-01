export interface Block {
  startLine: number;
  endLine: number;
  raw: string;
  oldLine?: number;
  newLine?: number;
  fileName?: string;
  isDeleted?: boolean;
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

    // Fenced code block: ``` or ~~~ with up to 3 spaces of leading indentation
    const fenceMatch = /^( {0,3})(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceLen = fenceMatch[2].length;
      const start = i;
      i++;
      while (i < lines.length) {
        const closing = /^( {0,3})(`{3,}|~{3,})/.exec(lines[i]);
        if (closing && closing[2][0] === fenceChar && closing[2].length >= fenceLen) {
          i++; // include closing fence
          break;
        }
        i++;
      }
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

export function parseLineIndent(raw: string): { raw: string; indent: number } {
  let indent = 0;
  const isFenced = /^( {0,3})(`{3,}|~{3,})/.test(raw);
  
  if (!isFenced) {
    const match = /^\s+/.exec(raw);
    indent = match ? match[0].length : 0;
    if (indent > 0) {
      raw = raw.trimStart();
    }
  }
  
  return { raw, indent };
}

export function parseDiff(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let oldLine = 0;
  let newLine = 0;
  let currentFile: string | undefined;
  let isDeleted = false;

  while (i < lines.length) {
    const line = lines[i];
    
    if (line.startsWith("diff --git")) {
      const match = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
      if (match) {
        currentFile = match[2];
      }
      isDeleted = false;
    }
    
    if (line.startsWith("deleted file mode")) {
      isDeleted = true;
    }

    const isOldFileLine = line.startsWith("--- a/") || line.startsWith("--- /dev/null");
    const isNewFileLine = i + 1 < lines.length && (lines[i + 1].startsWith("+++ b/") || lines[i + 1].startsWith("+++ /dev/null"));
    
    if (isOldFileLine && isNewFileLine) {
      const fileName = lines[i + 1] === "+++ /dev/null" ? line.substring(6) : lines[i + 1].substring(6);
      currentFile = fileName;
      
      blocks.push({
        startLine: i + 1,
        endLine: i + 2,
        raw: `File: ${currentFile}`,
        fileName: currentFile,
        isDeleted: isDeleted,
      });
      i += 2;
      continue;
    }

    const hunkMatch = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      blocks.push({
        startLine: i + 1,
        endLine: i + 1,
        raw: line,
        fileName: currentFile,
        isDeleted: isDeleted,
      });
      i++;
      continue;
    }

    if (line.startsWith("+")) {
      blocks.push({
        startLine: i + 1,
        endLine: i + 1,
        raw: line,
        newLine: newLine,
        fileName: currentFile,
        isDeleted: isDeleted,
      });
      newLine++;
      i++;
    } else if (line.startsWith("-")) {
      blocks.push({
        startLine: i + 1,
        endLine: i + 1,
        raw: line,
        oldLine: oldLine,
        fileName: currentFile,
        isDeleted: isDeleted,
      });
      oldLine++;
      i++;
    } else {
      const isHeader = line.startsWith("diff --git") || line.startsWith("index");
      blocks.push({
        startLine: i + 1,
        endLine: i + 1,
        raw: line,
        oldLine: isHeader ? undefined : oldLine,
        newLine: isHeader ? undefined : newLine,
        fileName: currentFile,
        isDeleted: isDeleted,
      });
      if (!isHeader) {
        oldLine++;
        newLine++;
      }
      i++;
    }
  }
  return blocks;
}
