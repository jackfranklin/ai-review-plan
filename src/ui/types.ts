export interface Comment {
  startLine: number;
  endLine: number;
  text: string;
}

export type { AiAnnotation, AiAnnotationsFile } from "../types/annotation.js";
