import { describe, it, expect } from "vitest";
import {
  ConsultationRequestSchema,
  ConsultationAnswerSchema,
  ConsultationStateSchema,
  ConsultationErrorSchema,
  FollowupRequestSchema,
  ConsultationStatusEnum,
  ConsultationModeEnum,
} from "../../src/core/protocol";

describe("ConsultationRequest schema", () => {
  it("accepts a valid full request", () => {
    const request = {
      schema: "consult-dad.request.v1",
      consultation_id: null,
      mode: "diagnose",
      caller: { agent: "gemini-cli", role: "worker" },
      goal: "Fix auth test failure",
      question: "Is this a race condition?",
      current_hypothesis: "Two refresh requests racing",
      attempts: [
        { action: "Added retry", outcome: "Still fails occasionally" },
      ],
      evidence: {
        failing_tests: ["test_refresh_concurrent"],
        errors: ["TokenRefreshError: already refreshing"],
        relevant_files: ["src/auth/refresh.ts"],
        git_diff: null,
      },
      constraints: {
        read_only: true,
        workspace_root: "/repo",
        max_followups: 3,
      },
      decision_needed: "Recommend next diagnostic action",
    };
    const result = ConsultationRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal request (only required fields)", () => {
    const request = {
      schema: "consult-dad.request.v1",
      mode: "consult",
      caller: { agent: "claude-code", role: "worker" },
      goal: "Decide on caching strategy",
      question: "Redis or materialized views?",
      decision_needed: "Choose approach",
    };
    const result = ConsultationRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("rejects request with invalid mode", () => {
    const request = {
      schema: "consult-dad.request.v1",
      mode: "execute",
      caller: { agent: "gemini-cli", role: "worker" },
      goal: "test",
      question: "test",
      decision_needed: "test",
    };
    const result = ConsultationRequestSchema.safeParse(request);
    expect(result.success).toBe(false);
  });

  it("rejects request missing required fields", () => {
    const result = ConsultationRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates all consultation modes", () => {
    const modes = ["consult", "diagnose", "review", "decide", "challenge", "takeover"];
    for (const mode of modes) {
      const result = ConsultationModeEnum.safeParse(mode);
      expect(result.success).toBe(true);
    }
  });

  it("validates all consultation statuses", () => {
    const statuses = ["created", "queued", "running", "input_required", "completed", "failed", "timed_out", "canceled"];
    for (const status of statuses) {
      const result = ConsultationStatusEnum.safeParse(status);
      expect(result.success).toBe(true);
    }
  });
});

describe("ConsultationAnswer schema", () => {
  it("accepts a valid answer", () => {
    const answer = {
      schema: "consult-dad.answer.v1",
      consultation_id: "dad_01HXYZ",
      status: "completed",
      advisor: { id: "staff-default", adapter: "codex" },
      verdict: "The retry is masking a shared-state race",
      recommendation: [
        "Remove retry during diagnosis",
        "Instrument refresh ownership",
      ],
      assumptions: ["Refresh state is shared between test workers"],
      risks: ["Keeping retry hides the real bug"],
      verification: ["Run failing test 100 times without retry"],
      confidence: "medium",
      worker_action: "continue",
      needs_followup: false,
    };
    const result = ConsultationAnswerSchema.safeParse(answer);
    expect(result.success).toBe(true);
  });

  it("rejects answer with invalid confidence", () => {
    const answer = {
      schema: "consult-dad.answer.v1",
      consultation_id: "dad_01",
      status: "completed",
      advisor: { id: "staff", adapter: "codex" },
      verdict: "test",
      confidence: "very_high",
      worker_action: "continue",
      needs_followup: false,
    };
    const result = ConsultationAnswerSchema.safeParse(answer);
    expect(result.success).toBe(false);
  });
});

describe("ConsultationError schema", () => {
  it("accepts a valid error", () => {
    const error = {
      code: "advisor_not_authenticated",
      advisor: "codex",
      recoverable: true,
      suggested_action: "Run dad doctor",
    };
    const result = ConsultationErrorSchema.safeParse(error);
    expect(result.success).toBe(true);
  });

  it("rejects invalid error code", () => {
    const result = ConsultationErrorSchema.safeParse({
      code: "unknown_error",
      recoverable: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("FollowupRequest schema", () => {
  it("accepts a valid followup", () => {
    const followup = {
      consultation_id: "dad_01HXYZ",
      message: "I tested option 2 and the race still exists",
      new_evidence: {
        errors: ["Still seeing concurrent refresh"],
      },
    };
    const result = FollowupRequestSchema.safeParse(followup);
    expect(result.success).toBe(true);
  });

  it("rejects followup with empty message", () => {
    const result = FollowupRequestSchema.safeParse({
      consultation_id: "dad_01",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});
