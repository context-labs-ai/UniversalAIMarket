import type { Response } from "express";
import { sendSse, sendSseComment } from "./sse.js";
import type { ChatMessagePayload, DealProposalPayload, FlowEmitter, SettlementCompletePayload, TimelineStepPayload, ToolCallPayload, ToolResultPayload } from "./flowEmitter.js";

export class SseFlowEmitter implements FlowEmitter {
  private res: Response;
  private sessionId: string;
  private now: () => number;

  constructor(res: Response, opts: { sessionId: string; now: () => number }) {
    this.res = res;
    this.sessionId = opts.sessionId;
    this.now = opts.now;
  }

  comment(comment: string) {
    sendSseComment(this.res, comment);
  }

  state(patch: Record<string, unknown>) {
    sendSse(this.res, "state", { ...patch, sessionId: this.sessionId });
  }

  timelineStep(step: TimelineStepPayload) {
    sendSse(this.res, "timeline_step", step);
  }

  message(msg: ChatMessagePayload) {
    sendSse(this.res, "message", msg);
  }

  dealProposal(proposal: DealProposalPayload) {
    sendSse(this.res, "deal_proposal", proposal);
  }

  settlementComplete(payload: SettlementCompletePayload) {
    sendSse(this.res, "settlement_complete", payload);
  }

  toolCall(call: ToolCallPayload) {
    sendSse(this.res, "tool_call", call);
  }

  toolResult(result: ToolResultPayload) {
    sendSse(this.res, "tool_result", result);
  }

  done(payload: unknown) {
    sendSse(this.res, "done", { ...((payload ?? {}) as any), ts: this.now() });
  }

  error(payload: unknown) {
    const message = payload instanceof Error ? payload.message : typeof payload === "string" ? payload : JSON.stringify(payload);
    sendSse(this.res, "error", { message, ts: this.now() });
  }
}

