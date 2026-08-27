import { ConsultationStatus } from "../core/protocol";

export const VALID_TRANSITIONS: Record<ConsultationStatus, ConsultationStatus[]> = {
  created: ["queued", "running", "canceled", "failed"],
  queued: ["running", "canceled", "failed", "timed_out"],
  running: ["input_required", "completed", "failed", "timed_out", "canceled"],
  input_required: ["running", "completed", "failed", "timed_out", "canceled"],
  completed: ["running", "canceled"], // can resume to running on followup
  failed: ["queued", "running"], // can retry
  timed_out: ["queued", "running"],
  canceled: [],
};

export class LifecycleStateMachine {
  static canTransition(from: ConsultationStatus, to: ConsultationStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: ConsultationStatus, to: ConsultationStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid lifecycle transition from '${from}' to '${to}'`);
    }
  }
}
