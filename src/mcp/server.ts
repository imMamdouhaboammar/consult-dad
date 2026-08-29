import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ConsultationBroker } from "../broker/broker";
import { AdvisorRegistry } from "../core/routing";
import { createMcpToolDefinitions } from "./tools";

export function createMcpServer(broker: ConsultationBroker, registry: AdvisorRegistry): Server {
  const server = new Server(
    {
      name: "consult-dad-mcp",
      version: "0.0.1",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  const tools = createMcpToolDefinitions(broker, registry);

  // 1. MCP Tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArguments } = request.params;
    const tool = tools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      return await tool.handler(toolArguments || {});
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Tool error: ${err.message || String(err)}` }],
        isError: true,
      };
    }
  });

  // 2. MCP Resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "dad://consultations/latest",
          name: "Latest Consultation",
          description: "Details and structured answer of the most recent consultation",
          mimeType: "application/json",
        },
        {
          uri: "dad://advisors",
          name: "Registered Advisors",
          description: "List of all registered Dad advisors and their readiness",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "dad://consultations/latest") {
      const recent = broker.list({ limit: 1 });
      const data = recent.length > 0 ? recent[0] : { message: "No consultations recorded yet" };
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith("dad://consultations/")) {
      const consultationId = uri.replace("dad://consultations/", "");
      const state = broker.status(consultationId);
      if (!state) {
        throw new Error(`Consultation '${consultationId}' not found`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(state, null, 2),
          },
        ],
      };
    }

    if (uri === "dad://advisors") {
      const advisors = await registry.list();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(advisors, null, 2),
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  // 3. MCP Prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "dad_escalation_triage",
          description: "Evaluate whether a task or failure warrants escalating to Dad",
          arguments: [
            {
              name: "attempts_made",
              description: "Number of attempts already tried",
              required: true,
            },
            {
              name: "problem_summary",
              description: "Description of the stubborn bug or architectural dilemma",
              required: true,
            },
          ],
        },
        {
          name: "dad_consult_brief",
          description: "Generate a formatted brief for calling dad_consult tool",
          arguments: [
            {
              name: "goal",
              description: "What the worker is trying to achieve",
              required: true,
            },
            {
              name: "question",
              description: "The specific question or decision needed",
              required: true,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;

    if (name === "dad_escalation_triage") {
      const attempts = promptArgs?.attempts_made || "2";
      const problem = promptArgs?.problem_summary || "Unknown issue";
      return {
        description: "Dad Escalation Triage Guide",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `You have made ${attempts} attempts on problem: "${problem}".
Evaluate escalation criteria:
1. Have 2+ materially different attempts failed?
2. Is this an architectural cross-roads (schema, concurrency, migration)?
3. Is there contradictory evidence between hypothesis and test logs?
If YES, formulate a brief and call dad_consult tool immediately.`,
            },
          },
        ],
      };
    }

    if (name === "dad_consult_brief") {
      const goal = promptArgs?.goal || "";
      const question = promptArgs?.question || "";
      return {
        description: "Dad Consultation Brief Formulation",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please format your consultation request as JSON for dad_consult:
Goal: ${goal}
Question: ${question}
Attach relevant files, error logs, and your current hypothesis.`,
            },
          },
        ],
      };
    }

    throw new Error(`Prompt not found: ${name}`);
  });

  return server;
}
