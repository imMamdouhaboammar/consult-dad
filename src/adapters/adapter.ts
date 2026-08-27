import {
  ConsultationRequest,
  ConsultationAnswer,
  FollowupRequest,
} from "../core/protocol";

export interface AdvisorAvailability {
  available: boolean;
  authenticated: boolean;
  version?: string;
  supports_resume: boolean;
  supports_background: boolean;
  supports_read_only: boolean;
  supports_structured_output: boolean;
  capabilities?: string[];
}

export interface AdvisorRun {
  consultation_id: string;
  advisor_id: string;
  native_session_id: string | null;
  status: "running" | "completed" | "failed" | "canceled";
  answer: ConsultationAnswer | null;
  stderr: string;
}

export interface AdvisorAdapter {
  readonly id: string;
  probe(): Promise<AdvisorAvailability>;
  start(request: ConsultationRequest): Promise<AdvisorRun>;
  resume(run: AdvisorRun, delta: FollowupRequest): Promise<AdvisorRun>;
  cancel(run: AdvisorRun): Promise<void>;
  result(run: AdvisorRun): Promise<ConsultationAnswer>;
}
