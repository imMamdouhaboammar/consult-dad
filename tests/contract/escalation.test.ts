import { describe, it, expect } from "vitest";
import { EscalationDetector, EscalationSignals } from "../../src/core/escalation";

describe("EscalationDetector", () => {
  const detector = new EscalationDetector();

  it.each([
    [
      "failure loop (2+ failed attempts)",
      { attemptsCount: 2, lastErrors: ["ECONNRESET", "ECONNRESET"], question: "Why does connection drop?" },
      "diagnose",
      "Failure loop detected",
    ],
    [
      "architectural decision keywords",
      { attemptsCount: 0, question: "Should we use database migration lock or schema versioning?" },
      "decide",
      "Architecture / Schema / Migration trigger",
    ],
    [
      "destructive action keywords",
      { attemptsCount: 0, question: "Drop table users and recreate with new foreign key constraint?" },
      "review",
      "Destructive action trigger",
    ],
    [
      "contradictory evidence flag",
      { attemptsCount: 1, question: "Test still fails", hasContradictoryEvidence: true },
      "challenge",
      "Contradictory evidence detected",
    ],
  ])("triggers on %s", (_, signals, expectedMode, reasonSnippet) => {
    const decision = detector.shouldConsult(signals);
    expect(decision.should).toBe(true);
    expect(decision.mode).toBe(expectedMode);
    expect(decision.reason).toContain(reasonSnippet);
  });

  it("does not trigger when work is progressing normally under threshold", () => {
    const signals: EscalationSignals = {
      attemptsCount: 1,
      question: "Fix typo in variable name",
    };

    const decision = detector.shouldConsult(signals);
    expect(decision.should).toBe(false);
  });

  it("respects max consultations cap per task", () => {
    const signals: EscalationSignals = {
      attemptsCount: 3,
      currentConsultationCountForTask: 3,
      question: "How to fix deadlock?",
    };

    const decision = detector.shouldConsult(signals);
    expect(decision.should).toBe(false);
    expect(decision.reason).toContain("Max consultations per task cap reached");
  });
});
