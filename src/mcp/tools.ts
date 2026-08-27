import { ConsultationBroker } from "../broker/broker";
import { AdvisorRegistry } from "../core/routing";
import { ConsultationModeEnum, ConsultationRequestInput } from "../core/protocol";

export function createMcpToolDefinitions(broker: ConsultationBroker, registry: AdvisorRegistry) {
  return [
    {
      name: "dad_consult",
      description: "Consult Dad (Staff Engineer role) on an architectural decision, debugging block, or tricky choice.",
      inputSchema: {
        type: "object",
        properties: {
          goal: { type: "string", description: "What the worker is trying to achieve" },
          question: { type: "string", description: "Specific decision or diagnosis requested" },
          mode: {
            type: "string",
            enum: ["consult", "diagnose", "review", "decide", "challenge", "takeover"],
            default: "consult",
          },
          current_hypothesis: { type: "string", description: "Current theory of the issue" },
          relevant_files: { type: "array", items: { type: "string" } },
          errors: { type: "array", items: { type: "string" } },
          decision_needed: { type: "string", description: "What exact decision is needed from Dad" },
          advisor_id: { type: "string", description: "Optional explicit advisor" },
        },
        required: ["goal", "question"],
      },
      handler: async (toolInput: any) => {
        const mode = toolInput.mode ? ConsultationModeEnum.parse(toolInput.mode) : "consult";
        const request: ConsultationRequestInput = {
          mode,
          caller: { agent: "mcp-caller", role: "worker" },
          goal: toolInput.goal,
          question: toolInput.question,
          current_hypothesis: toolInput.current_hypothesis,
          attempts: [],
          evidence: {
            relevant_files: toolInput.relevant_files || [],
            errors: toolInput.errors || [],
          },
          constraints: { read_only: true },
          decision_needed: toolInput.decision_needed || toolInput.question,
        };

        const id = await broker.consult(request, undefined, toolInput.advisor_id);
        const answer = await broker.result(id);
        return {
          content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
          isError: false,
        };
      },
    },
    {
      name: "dad_followup",
      description: "Continue an existing Dad consultation thread with new diagnostic observations or test results.",
      inputSchema: {
        type: "object",
        properties: {
          consultation_id: { type: "string", description: "Consultation ID handle (e.g. dad_01...)" },
          message: { type: "string", description: "Update, result, or new observation" },
        },
        required: ["consultation_id", "message"],
      },
      handler: async (toolInput: any) => {
        await broker.followup(toolInput.consultation_id, toolInput.message);
        const answer = await broker.result(toolInput.consultation_id);
        return {
          content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
          isError: false,
        };
      },
    },
    {
      name: "dad_status",
      description: "Check the status and history of consultations.",
      inputSchema: {
        type: "object",
        properties: {
          consultation_id: { type: "string", description: "Optional consultation ID" },
        },
      },
      handler: async (toolInput: any) => {
        if (toolInput.consultation_id) {
          const state = broker.status(toolInput.consultation_id);
          return {
            content: [{ type: "text", text: JSON.stringify(state || { error: "not found" }, null, 2) }],
            isError: !state,
          };
        } else {
          const list = broker.list({ limit: 10 });
          return {
            content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
            isError: false,
          };
        }
      },
    },
    {
      name: "dad_result",
      description: "Retrieve completed answer for a consultation ID.",
      inputSchema: {
        type: "object",
        properties: {
          consultation_id: { type: "string", description: "Consultation ID handle" },
        },
        required: ["consultation_id"],
      },
      handler: async (toolInput: any) => {
        const answer = await broker.result(toolInput.consultation_id);
        return {
          content: [{ type: "text", text: JSON.stringify(answer, null, 2) }],
          isError: false,
        };
      },
    },
    {
      name: "dad_cancel",
      description: "Cancel an ongoing consultation.",
      inputSchema: {
        type: "object",
        properties: {
          consultation_id: { type: "string", description: "Consultation ID handle" },
        },
        required: ["consultation_id"],
      },
      handler: async (toolInput: any) => {
        await broker.cancel(toolInput.consultation_id);
        return {
          content: [{ type: "text", text: JSON.stringify({ status: "canceled", consultation_id: toolInput.consultation_id }) }],
          isError: false,
        };
      },
    },
    {
      name: "dad_list_advisors",
      description: "List all registered Dad advisors and their readiness.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => {
        const list = await registry.list();
        return {
          content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
          isError: false,
        };
      },
    },
    {
      name: "dad_explain_route",
      description: "Explain which advisor would be chosen for a given question and why.",
      inputSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          mode: { type: "string", default: "consult" },
        },
        required: ["question"],
      },
      handler: async (toolInput: any) => {
        const explanation = await registry.explain({
          schema: "consult-dad.request.v1",
          mode: (toolInput.mode as any) || "consult",
          caller: { agent: "mcp-user", role: "worker" },
          goal: toolInput.question,
          question: toolInput.question,
          decision_needed: toolInput.question,
        });
        return {
          content: [{ type: "text", text: explanation }],
          isError: false,
        };
      },
    },
  ];
}
