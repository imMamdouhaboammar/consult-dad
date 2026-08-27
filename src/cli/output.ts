import { ConsultationAnswer, ConsultationState } from "../core/protocol";

export interface OutputOptions {
  json?: boolean;
}

export class OutputFormatter {
  static formatAnswer(answer: ConsultationAnswer, options: OutputOptions = {}): void {
    if (options.json) {
      this.formatAnswerJson(answer);
    } else {
      this.formatAnswerHuman(answer);
    }
  }

  static formatAnswerJson(answer: ConsultationAnswer): void {
    console.log(JSON.stringify(answer, null, 2));
  }

  static formatAnswerHuman(answer: ConsultationAnswer): void {
    console.log("\n================ DAD CONSULTATION RESULT ================");
    console.log(`Advisor:      ${answer.advisor.id} (${answer.advisor.adapter})`);
    console.log(`Confidence:   ${answer.confidence.toUpperCase()}`);
    console.log(`Worker Action: ${answer.worker_action.toUpperCase()}`);
    console.log(`\nVerdict:\n  ${answer.verdict}`);

    if (answer.recommendation.length > 0) {
      console.log("\nRecommendations:");
      answer.recommendation.forEach((rec, idx) => console.log(`  ${idx + 1}. ${rec}`));
    }

    if (answer.assumptions.length > 0) {
      console.log("\nAssumptions:");
      answer.assumptions.forEach((assumption) => console.log(`  - ${assumption}`));
    }

    if (answer.risks.length > 0) {
      console.log("\nRisks:");
      answer.risks.forEach((riskItem) => console.log(`  ⚠ ${riskItem}`));
    }

    if (answer.verification.length > 0) {
      console.log("\nVerification Steps:");
      answer.verification.forEach((verificationStep) => console.log(`  ✓ ${verificationStep}`));
    }

    console.log(`\nConsultation ID: ${answer.consultation_id}`);
    console.log("========================================================\n");
  }

  static formatState(state: ConsultationState, options: OutputOptions = {}): void {
    if (options.json) {
      this.formatStateJson(state);
    } else {
      this.formatStateHuman(state);
    }
  }

  static formatStateJson(state: ConsultationState): void {
    console.log(JSON.stringify(state, null, 2));
  }

  static formatStateHuman(state: ConsultationState): void {
    console.log(`\n[Consultation ${state.consultation_id}]`);
    console.log(`Status:     ${state.status.toUpperCase()}`);
    console.log(`Mode:       ${state.mode}`);
    console.log(`Caller:     ${state.caller_id}`);
    console.log(`Advisor:    ${state.advisor_id || "none"}`);
    console.log(`Started:    ${state.started_at}`);
    if (state.finished_at) {
      console.log(`Finished:   ${state.finished_at}`);
    }
    console.log(`Goal:       ${state.request.goal}`);
    console.log(`Question:   ${state.request.question}`);

    if (state.events.length > 0) {
      console.log("\nEvents:");
      state.events.forEach((ev) => {
        console.log(`  [${ev.timestamp}] ${ev.type}${ev.detail ? `: ${ev.detail}` : ""}`);
      });
    }
  }

  static formatError(error: any, options: OutputOptions = {}): void {
    if (options.json) {
      this.formatErrorJson(error);
    } else {
      this.formatErrorHuman(error);
    }
  }

  static formatErrorJson(error: any): void {
    console.error(JSON.stringify({
      error: {
        code: error.code || "unknown_error",
        message: error.message || String(error),
        recoverable: error.recoverable ?? true,
        suggested_action: error.suggested_action || "Run 'dad doctor' to inspect environment",
      }
    }, null, 2));
  }

  static formatErrorHuman(error: any): void {
    console.error(`\n❌ Error: ${error.message || String(error)}`);
    if (error.suggested_action) {
      console.error(`👉 Suggestion: ${error.suggested_action}`);
    }
  }
}
