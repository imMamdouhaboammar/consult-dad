import { ConsultationMode } from "./protocol";

export interface EscalationSignals {
  attemptsCount: number;
  lastErrors?: string[];
  question?: string;
  hasContradictoryEvidence?: boolean;
  isVerificationFailing?: boolean;
  currentConsultationCountForTask?: number;
}

export interface EscalationDecision {
  should: boolean;
  reason: string;
  mode: ConsultationMode;
  suggestedAdvisor?: string;
}

export interface EscalationConfig {
  maxAttemptsBeforeConsult?: number;
  maxConsultationsPerTask?: number;
}

const ARCHITECTURE_KEYWORDS = [
  "schema",
  "migration",
  "database",
  "concurrency",
  "deadlock",
  "race condition",
  "shared state",
  "backward compatibility",
  "public api",
  "auth",
  "oauth",
  "jwt",
  "permission",
];

const DESTRUCTIVE_KEYWORDS = [
  "drop table",
  "delete data",
  "rewrite history",
  "force push",
  "rm -rf",
  "reset --hard",
  "revoke",
  "truncate",
  "purge",
];

export class EscalationDetector {
  private maxAttempts: number;
  private maxConsultations: number;

  constructor(config: EscalationConfig = {}) {
    this.maxAttempts = config.maxAttemptsBeforeConsult ?? 2;
    this.maxConsultations = config.maxConsultationsPerTask ?? 3;
  }

  shouldConsult(signals: EscalationSignals): EscalationDecision {
    const consultationCount = signals.currentConsultationCountForTask ?? 0;
    if (consultationCount >= this.maxConsultations) {
      return {
        should: false,
        reason: `Max consultations per task cap reached (${consultationCount}/${this.maxConsultations})`,
        mode: "consult",
      };
    }

    const questionText = (signals.question || "").toLowerCase();

    if (this.isDestructiveAction(questionText)) {
      return {
        should: true,
        reason: "Destructive action trigger: High-risk mutation detected. Advise review before execution.",
        mode: "review",
      };
    }

    if (signals.hasContradictoryEvidence) {
      return {
        should: true,
        reason: "Contradictory evidence detected: Hypothesized behavior conflicts with runtime evidence.",
        mode: "challenge",
      };
    }

    if (signals.attemptsCount >= this.maxAttempts) {
      return {
        should: true,
        reason: `Failure loop detected: ${signals.attemptsCount} attempts without resolution.`,
        mode: "diagnose",
      };
    }

    if (this.isArchitecturalDecision(questionText)) {
      return {
        should: true,
        reason: "Architecture / Schema / Migration trigger: Cross-cutting architectural decision detected.",
        mode: "decide",
      };
    }

    if (signals.isVerificationFailing && signals.attemptsCount >= 1) {
      return {
        should: true,
        reason: "Verification failure trigger: Implementation appears complete but verification test fails.",
        mode: "diagnose",
      };
    }

    return {
      should: false,
      reason: "No escalation triggers met. Worker can proceed autonomously.",
      mode: "consult",
    };
  }

  private isDestructiveAction(normalizedQuestion: string): boolean {
    return DESTRUCTIVE_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
  }

  private isArchitecturalDecision(normalizedQuestion: string): boolean {
    return ARCHITECTURE_KEYWORDS.some((keyword) => normalizedQuestion.includes(keyword));
  }
}
