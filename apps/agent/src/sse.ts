import type { Response } from "express";

export type SseEventName =
  | "message"
  | "tool_call"
  | "tool_result"
  | "timeline_step"
  | "state"
  | "done"
  | "error";

export function initSse(res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function sendSse(res: Response, event: SseEventName, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function sendSseComment(res: Response, comment: string) {
  res.write(`: ${comment}\n\n`);
}

