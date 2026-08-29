import { z } from "zod";

export const AdvisorConfigSchema = z.object({
  adapter: z.string(),
  model: z.string().optional(),
  command: z.string().optional(),
  capabilities: z.array(z.string()).optional().default([]),
  priority: z.number().int().optional().default(100),
});
export type AdvisorConfig = z.infer<typeof AdvisorConfigSchema>;

export const EscalationTriggersConfigSchema = z.object({
  architecture: z.boolean().optional().default(true),
  auth: z.boolean().optional().default(true),
  migrations: z.boolean().optional().default(true),
  destructive: z.boolean().optional().default(true),
  repeated_failure: z.boolean().optional().default(true),
});
export type EscalationTriggersConfig = z.infer<typeof EscalationTriggersConfigSchema>;

export const EscalationSectionConfigSchema = z.object({
  auto: z.boolean().optional().default(true),
  max_attempts_before_consult: z.number().int().min(1).optional().default(2),
  triggers: EscalationTriggersConfigSchema.optional().default({}),
  max_consultations_per_task: z.number().int().min(1).optional().default(3),
  max_depth: z.number().int().max(1).optional().default(1),
});
export type EscalationSectionConfig = z.infer<typeof EscalationSectionConfigSchema>;

export const ConsultDadConfigSchema = z.object({
  $schema: z.string().optional(),
  version: z.string().optional().default("1.0.0"),
  default_advisor: z.string().optional().default("staff"),
  advisors: z.record(AdvisorConfigSchema).optional().default({}),
  escalation: EscalationSectionConfigSchema.optional().default({}),
  timeout_ms: z.number().int().positive().optional().default(120_000),
});
export type ConsultDadConfig = z.infer<typeof ConsultDadConfigSchema>;
export type ConsultDadConfigInput = z.input<typeof ConsultDadConfigSchema>;
