import { ConsultationRequest } from "./protocol";

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface EscalationPolicyConfig {
  maxDepth?: number;
  maxConsultationsPerTask?: number;
  allowTakeover?: boolean;
}

export class EscalationPolicy {
  private config: EscalationPolicyConfig;

  constructor(config: EscalationPolicyConfig = {}) {
    this.config = {
      maxDepth: 1,
      maxConsultationsPerTask: 3,
      allowTakeover: false,
      ...config,
    };
  }

  validate(request: ConsultationRequest): PolicyValidationResult {
    // 1. Enforce max_depth: 1 (Dad cannot consult Dad)
    const role = (request.caller.role || "").toLowerCase();
    const agent = (request.caller.agent || "").toLowerCase();
    if (role.includes("dad") || role.includes("advisor") || agent.includes("dad")) {
      return {
        allowed: false,
        reason: "policy_denied: Recursive Dad consultation forbidden (max_depth: 1)",
      };
    }

    // 2. Takeover mode check
    if (request.mode === "takeover" && !this.config.allowTakeover) {
      if (request.constraints.read_only !== false) {
        return {
          allowed: false,
          reason: "policy_denied: Takeover requires explicit write permissions (--allow-write)",
        };
      }
    }

    return { allowed: true };
  }
}
