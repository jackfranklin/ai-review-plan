import type { AiAnnotation } from "./types.js";

// Fenced code block opener: ``` or ~~~ with any leading indentation
const FENCE_RE = /^( *)(`{3,}|~{3,})/;
// GFM table delimiter row (e.g. |---|---| or ---|---, indented up to 3 spaces)
const TABLE_DELIMITER_RE = /^[ \t]*(?:\|)?[ \t]*(?::?-+:?[ \t]*\|[ \t]*)*:?-+:?[ \t]*(?:\|)?[ \t]*$/;

export interface Block {
  type: "file-header" | "hunk" | "diff-line" | "content";
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

    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const fenceChar = fenceMatch[2][0];
      const fenceLen = fenceMatch[2].length;
      const start = i;
      i++;
      while (i < lines.length) {
        const closing = FENCE_RE.exec(lines[i]);
        if (closing && closing[2][0] === fenceChar && closing[2].length >= fenceLen) {
          i++; // include closing fence
          break;
        }
        i++;
      }
      blocks.push({
        type: "content",
        startLine: start + 1,
        endLine: i,
        raw: lines.slice(start, i).join("\n"),
      });
      continue;
    }

    // Markdown Table: starts with a header line containing a pipe, followed by a delimiter line
    if (i + 1 < lines.length && line.includes("|") && lines[i + 1].includes("|") && TABLE_DELIMITER_RE.test(lines[i + 1])) {
      const start = i;
      i += 2; // skip header and delimiter
      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine.includes("|") || nextLine.trim() === "") {
          break;
        }
        if (FENCE_RE.exec(nextLine)) {
          break;
        }
        i++;
      }
      blocks.push({
        type: "content",
        startLine: start + 1,
        endLine: i,
        raw: lines.slice(start, i).join("\n"),
      });
      continue;
    }

    // Single line (handles headings, list items, blockquotes, blank lines, etc.)
    blocks.push({
      type: "content",
      startLine: i + 1,
      endLine: i + 1,
      raw: line,
    });
    i++;
  }

  return blocks;
}

export function parseLineIndent(raw: string): { raw: string; indent: number } {
  if (raw.includes("\n")) {
    const match = /^[ \t]*/.exec(raw);
    const indent = match ? match[0].length : 0;
    if (indent > 0) {
      const lines = raw.split("\n");
      const strippedLines = lines.map(line => {
        if (line.startsWith(" ".repeat(indent))) {
          return line.substring(indent);
        }
        const spaces = /^\s*/.exec(line)?.[0].length ?? 0;
        return line.substring(spaces);
      });
      return {
        raw: strippedLines.join("\n"),
        indent
      };
    }
    return { raw, indent: 0 };
  }

  let indent = 0;
  const match = /^\s+/.exec(raw);
  indent = match ? match[0].length : 0;
  if (indent > 0) {
    raw = raw.trimStart();
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
        type: "file-header",
        startLine: i + 1,
        endLine: i + 2,
        raw: currentFile,
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
        type: "hunk",
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
        type: "diff-line",
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
        type: "diff-line",
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
        type: "diff-line",
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

export interface FileItem {
  name: string;
  isDeleted: boolean;
}

export interface BlockGroup {
  fileName: string | undefined;
  isDeleted: boolean;
  blocks: Block[];
}

export interface FileGroup {
  dirPath: string;
  files: Array<{
    name: string;
    isDeleted: boolean;
    displayName: string;
  }>;
}

export function groupFilesByDirectory(files: FileItem[]): FileGroup[] {
  const groupsMap = new Map<string, Array<{ name: string; isDeleted: boolean; displayName: string }>>();
  for (const file of files) {
    const lastSlash = file.name.lastIndexOf("/");
    const dirPath = lastSlash === -1 ? "" : file.name.substring(0, lastSlash);
    const displayName = lastSlash === -1 ? file.name : file.name.substring(lastSlash + 1);

    let group = groupsMap.get(dirPath);
    if (!group) {
      group = [];
      groupsMap.set(dirPath, group);
    }
    group.push({ name: file.name, isDeleted: file.isDeleted, displayName });
  }

  const groups: FileGroup[] = [];
  for (const [dirPath, groupFiles] of groupsMap.entries()) {
    groupFiles.sort((a, b) => a.displayName.localeCompare(b.displayName));
    groups.push({ dirPath, files: groupFiles });
  }

  groups.sort((a, b) => {
    if (a.dirPath === "" && b.dirPath !== "") return 1;
    if (a.dirPath !== "" && b.dirPath === "") return -1;
    return a.dirPath.localeCompare(b.dirPath);
  });

  return groups;
}

export function mapAnnotationsToBlocks(
  annotations: AiAnnotation[],
  blocks: Block[],
  mode: "plan" | "diff"
): Map<number, AiAnnotation[]> {
  const result = new Map<number, AiAnnotation[]>();

  for (const annotation of annotations) {
    let targetBlock: Block | undefined;

    if (mode === "plan") {
      targetBlock =
        blocks.find(
          (b) =>
            b.startLine <= annotation.startLine &&
            annotation.startLine <= b.endLine
        ) ?? blocks.find((b) => b.startLine >= annotation.startLine);
    } else {
      const useOld = annotation.lineType === "old";
      targetBlock = blocks.find(
        (b) =>
          b.fileName === annotation.file &&
          (useOld
            ? b.oldLine !== undefined &&
              b.oldLine >= annotation.startLine &&
              b.oldLine <= annotation.endLine
            : b.newLine !== undefined &&
              b.newLine >= annotation.startLine &&
              b.newLine <= annotation.endLine)
      );
    }

    if (targetBlock) {
      const key = targetBlock.startLine;
      const list = result.get(key);
      if (list !== undefined) {
        list.push(annotation);
      } else {
        result.set(key, [annotation]);
      }
    }
  }

  return result;
}

export function computeGroupedBlocks(blocks: Block[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  let currentGroup: BlockGroup | null = null;
  for (const block of blocks) {
    if (!currentGroup || block.fileName !== currentGroup.fileName) {
      currentGroup = { fileName: block.fileName, isDeleted: block.isDeleted || false, blocks: [block] };
      groups.push(currentGroup);
    } else {
      currentGroup.blocks.push(block);
    }
  }
  return groups;
}
