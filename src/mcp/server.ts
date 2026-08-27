import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
      },
    }
  );

  const tools = createMcpToolDefinitions(broker, registry);

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

  return server;
}
