import type { AiAnnotation } from "./annotation.js";

export interface PlanUpdatePayload {
  markdown: string;
  aiSummary?: string;
  aiAnnotations?: AiAnnotation[];
}

export type SubmitStatus = "ok" | "waiting_for_updates" | "closing";
