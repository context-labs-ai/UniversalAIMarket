import type { FlowEmitter, TimelineStepPayload, ChatMessagePayload, ToolCallPayload, ToolResultPayload, DealProposalPayload, SettlementCompletePayload } from "./flowEmitter.js";
import { emitRunEvent, markRunDone } from "./runSessions.js";

export class RunSessionEmitter implements FlowEmitter {
  constructor(
    private readonly sessionId: string,
    private readonly now: () => number
  ) {}

  comment(comment: string) {
    // Comments are not persisted as events; use state for important info.
    emitRunEvent(this.sessionId, "state", { comment, ts: this.now() });
  }

  state(patch: Record<string, unknown>) {
    emitRunEvent(this.sessionId, "state", { ...patch, ts: this.now(), sessionId: this.sessionId });
  }

  timelineStep(step: TimelineStepPayload) {
    emitRunEvent(this.sessionId, "timeline_step", step);
  }

  message(msg: ChatMessagePayload) {
    emitRunEvent(this.sessionId, "message", msg);
  }

  dealProposal(proposal: DealProposalPayload) {
    emitRunEvent(this.sessionId, "deal_proposal", proposal);
  }

  settlementComplete(payload: SettlementCompletePayload) {
    emitRunEvent(this.sessionId, "settlement_complete", payload);
  }

  toolCall(call: ToolCallPayload) {
    emitRunEvent(this.sessionId, "tool_call", call);
  }

  toolResult(result: ToolResultPayload) {
    emitRunEvent(this.sessionId, "tool_result", result);
  }

  done(payload: unknown) {
    emitRunEvent(this.sessionId, "done", payload);
    markRunDone(this.sessionId);
  }

  error(payload: unknown) {
    emitRunEvent(this.sessionId, "error", payload);
    markRunDone(this.sessionId);
  }
}

