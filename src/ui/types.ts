export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export interface AiAnnotation {
  file?: string;      // diff mode only: source file path (e.g. "src/foo.ts")
  startLine: number;  // 1-indexed; source line for diff, plan-file line for plan
  endLine: number;
  text: string;
}

export interface AiAnnotationsFile {
  summary?: string;
  annotations?: AiAnnotation[];
}
