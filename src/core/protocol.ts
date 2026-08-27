import { z } from "zod";

// --- Enums ---

export const ConsultationModeEnum = z.enum([
  "consult",
  "diagnose",
  "review",
  "decide",
  "challenge",
  "takeover",
]);
export type ConsultationMode = z.infer<typeof ConsultationModeEnum>;

export const ConsultationStatusEnum = z.enum([
  "created",
  "queued",
  "running",
  "input_required",
  "completed",
  "failed",
  "timed_out",
  "canceled",
]);
export type ConsultationStatus = z.infer<typeof ConsultationStatusEnum>;

export const ConfidenceEnum = z.enum(["high", "medium", "low"]);

export const WorkerActionEnum = z.enum([
  "continue",
  "retry",
  "escalate",
  "abort",
]);

// --- Request ---

export const AttemptSchema = z.object({
  action: z.string(),
  outcome: z.string(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const EvidenceSchema = z.object({
  failing_tests: z.array(z.string()).optional().default([]),
  errors: z.array(z.string()).optional().default([]),
  relevant_files: z.array(z.string()).optional().default([]),
  git_diff: z.string().nullable().optional().default(null),
  logs: z.array(z.string()).optional().default([]),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const ConstraintsSchema = z.object({
  read_only: z.boolean().optional().default(true),
  workspace_root: z.string().optional(),
  max_followups: z.number().int().positive().optional().default(5),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

export const CallerSchema = z.object({
  agent: z.string(),
  role: z.string(),
});
export type Caller = z.infer<typeof CallerSchema>;

export const ConsultationRequestSchema = z.object({
  schema: z.literal("consult-dad.request.v1").default("consult-dad.request.v1"),
  consultation_id: z.string().nullable().optional().default(null),
  mode: ConsultationModeEnum,
  caller: CallerSchema,
  goal: z.string().min(1),
  question: z.string().min(1),
  current_hypothesis: z.string().optional(),
  attempts: z.array(AttemptSchema).optional().default([]),
  evidence: EvidenceSchema.optional().default({}),
  constraints: ConstraintsSchema.optional().default({}),
  decision_needed: z.string().min(1),
});
export type ConsultationRequest = z.infer<typeof ConsultationRequestSchema>;
export type ConsultationRequestInput = z.input<typeof ConsultationRequestSchema>;

// --- Answer ---

export const AdvisorInfoSchema = z.object({
  id: z.string(),
  adapter: z.string(),
});
export type AdvisorInfo = z.infer<typeof AdvisorInfoSchema>;

export const ConsultationAnswerSchema = z.object({
  schema: z.literal("consult-dad.answer.v1"),
  consultation_id: z.string(),
  status: z.enum(["completed", "partial", "failed"]),
  advisor: AdvisorInfoSchema,
  verdict: z.string(),
  recommendation: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  verification: z.array(z.string()).default([]),
  confidence: ConfidenceEnum,
  worker_action: WorkerActionEnum,
  needs_followup: z.boolean(),
});
export type ConsultationAnswer = z.infer<typeof ConsultationAnswerSchema>;

// --- Consultation State ---

export const ConsultationEventSchema = z.object({
  timestamp: z.string().datetime(),
  type: z.string(),
  detail: z.string().optional(),
});
export type ConsultationEvent = z.infer<typeof ConsultationEventSchema>;

export const ConsultationStateSchema = z.object({
  consultation_id: z.string(),
  context_id: z.string().optional(),
  advisor_id: z.string().optional(),
  native_session_id: z.string().nullable().optional(),
  caller_id: z.string(),
  mode: ConsultationModeEnum,
  status: ConsultationStatusEnum,
  started_at: z.string().datetime(),
  finished_at: z.string().datetime().nullable().optional(),
  request: ConsultationRequestSchema,
  answer: ConsultationAnswerSchema.nullable().optional(),
  events: z.array(ConsultationEventSchema).default([]),
  artifacts: z.array(z.string()).default([]),
  errors: z.array(z.any()).default([]),
});
export type ConsultationState = z.infer<typeof ConsultationStateSchema>;

// --- Error ---

export const ErrorCodeEnum = z.enum([
  "advisor_unavailable",
  "advisor_not_authenticated",
  "unsupported_model",
  "policy_denied",
  "context_too_large",
  "timeout",
  "advisor_crashed",
  "invalid_response",
  "resume_failed",
  "workspace_violation",
  "cancelled",
]);

export const ConsultationErrorSchema = z.object({
  code: ErrorCodeEnum,
  advisor: z.string().optional(),
  recoverable: z.boolean(),
  suggested_action: z.string().optional(),
});
export type ConsultationError = z.infer<typeof ConsultationErrorSchema>;

// --- Followup ---

export const FollowupRequestSchema = z.object({
  consultation_id: z.string(),
  message: z.string().min(1),
  new_evidence: EvidenceSchema.optional(),
});
export type FollowupRequest = z.infer<typeof FollowupRequestSchema>;
