import type { Response } from "express";
import { randomUUID } from "crypto";
import { EventType, type BaseEvent } from "@ag-ui/core";
import type {
  ChatMessagePayload,
  FlowEmitter,
  TimelineStepPayload,
  ToolCallPayload,
  ToolResultPayload,
} from "./flowEmitter.js";

export class AguiEmitter implements FlowEmitter {
  private res: Response;
  private sessionId: string;
  private snapshot: Record<string, unknown> = {};
  private now: () => number;

  constructor(res: Response, { sessionId, now }: { sessionId: string; now: () => number }) {
    this.res = res;
    this.sessionId = sessionId;
    this.now = now;
    this.init();
  }

  private init() {
    this.res.status(200);
    this.res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    this.res.setHeader("Cache-Control", "no-cache, no-transform");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
    this.res.flushHeaders?.();
  }

  private send(event: BaseEvent) {
    const payload = { ...event, timestamp: event.timestamp ?? this.now() };
    this.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }

  comment(comment: string) {
    this.res.write(`: ${comment}\n\n`);
  }

  sendRunStarted(input: Record<string, unknown>) {
    const threadId = typeof (input as any)?.threadId === "string" ? String((input as any).threadId) : this.sessionId;
    const runId = typeof (input as any)?.runId === "string" ? String((input as any).runId) : this.sessionId;
    const parentRunId = typeof (input as any)?.parentRunId === "string" ? String((input as any).parentRunId) : undefined;
    this.send({
      type: EventType.RUN_STARTED,
      threadId,
      runId,
      parentRunId,
      input: input as any,
    } as any);

    this.snapshot = { sessionId: this.sessionId, threadId, runId };
    this.send({ type: EventType.STATE_SNAPSHOT, snapshot: this.snapshot } as any);
  }

  state(patch: Record<string, unknown>) {
    this.snapshot = { ...this.snapshot, ...patch, sessionId: this.sessionId };
    this.send({ type: EventType.STATE_SNAPSHOT, snapshot: this.snapshot } as any);
  }

  timelineStep(step: TimelineStepPayload) {
    const name = step.id;
    if (step.status === "running") {
      this.send({ type: EventType.STEP_STARTED, stepName: name, rawEvent: step } as any);
    } else if (step.status === "done" || step.status === "error") {
      this.send({ type: EventType.STEP_FINISHED, stepName: name, rawEvent: step } as any);
    }
    this.send({ type: EventType.CUSTOM, name: "universal_market.timeline_step", value: step } as any);
  }

  message(msg: ChatMessagePayload) {
    // AG-UI text message roles are limited; keep "assistant" and attach metadata in rawEvent.
    this.send({
      type: EventType.TEXT_MESSAGE_START,
      messageId: msg.id,
      role: "assistant",
      rawEvent: msg,
    } as any);
    this.send({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: msg.id,
      delta: msg.content,
      rawEvent: msg,
    } as any);
    this.send({ type: EventType.TEXT_MESSAGE_END, messageId: msg.id, rawEvent: msg } as any);
  }

  toolCall(call: ToolCallPayload) {
    this.send({
      type: EventType.TOOL_CALL_START,
      toolCallId: call.id,
      toolCallName: call.name,
      rawEvent: call,
    } as any);
    this.send({
      type: EventType.TOOL_CALL_ARGS,
      toolCallId: call.id,
      delta: JSON.stringify(call.args ?? {}),
      rawEvent: call,
    } as any);
    this.send({ type: EventType.TOOL_CALL_END, toolCallId: call.id, rawEvent: call } as any);
  }

  toolResult(result: ToolResultPayload) {
    const content = typeof result.result === "string" ? result.result : JSON.stringify(result.result);
    this.send({
      type: EventType.TOOL_CALL_RESULT,
      messageId: randomUUID(),
      toolCallId: result.id,
      content,
      role: "tool",
      rawEvent: result,
    } as any);
  }

  done(payload: unknown) {
    const result = payload;
    const threadId = typeof this.snapshot.threadId === "string" ? String(this.snapshot.threadId) : this.sessionId;
    const runId = typeof this.snapshot.runId === "string" ? String(this.snapshot.runId) : this.sessionId;
    this.send({ type: EventType.RUN_FINISHED, threadId, runId, result } as any);
  }

  error(payload: unknown) {
    const message = typeof payload === "string" ? payload : JSON.stringify(payload);
    this.send({ type: EventType.RUN_ERROR, message, rawEvent: payload } as any);
  }
}
