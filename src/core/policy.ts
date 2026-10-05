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
  private config: Required<EscalationPolicyConfig>;

  constructor(config: EscalationPolicyConfig = {}) {
    this.config = {
      maxDepth: 1,
      maxConsultationsPerTask: 3,
      allowTakeover: true,
      ...config,
    };
  }

  validate(request: ConsultationRequest): PolicyValidationResult {
    const role = (request.caller.role || "").toLowerCase();
    const agent = (request.caller.agent || "").toLowerCase();

    if (role.includes("dad") || role.includes("advisor") || agent.includes("dad")) {
      return {
        allowed: false,
        reason: "policy_denied: Recursive Dad consultation forbidden (max_depth: 1)",
      };
    }

    const writeAuthorized = request.constraints?.read_only === false;

    if (request.mode === "takeover") {
      if (!this.config.allowTakeover) {
        return {
          allowed: false,
          reason: "policy_denied: Takeover is disabled by runtime policy",
        };
      }

      if (!writeAuthorized) {
        return {
          allowed: false,
          reason: "policy_denied: Takeover requires explicit write authorization",
        };
      }

      return { allowed: true };
    }

    if (writeAuthorized) {
      return {
        allowed: false,
        reason: "policy_denied: Write authorization is valid only in takeover mode",
      };
    }

    return { allowed: true };
  }
}
