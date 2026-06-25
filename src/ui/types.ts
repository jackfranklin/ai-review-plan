export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

// NOTE: AiAnnotation and AiAnnotationsFile are mirrored in src/server/server.ts.
// Keep them in sync — they can't share a source due to separate tsconfig rootDirs.
export interface AiAnnotation {
  file?: string;                  // diff mode only: source file path (e.g. "src/foo.ts")
  startLine: number;              // 1-indexed; source line for diff, plan-file line for plan
  endLine: number;
  lineType?: "new" | "old";       // diff mode only: which side the line numbers refer to (default: "new")
  text: string;
}

export interface AiAnnotationsFile {
  summary?: string;
  annotations?: AiAnnotation[];
}
