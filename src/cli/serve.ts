import { Command } from "commander";
import { runStdioServer } from "../mcp/stdio";

export function createServeCommand(): Command {
  return new Command("serve")
    .description("Start the Consult Dad MCP server")
    .option("--stdio", "Use standard I/O transport (default)", true)
    .action(async () => {
      try {
        await runStdioServer();
      } catch (err: unknown) {
        console.error("Failed to start Consult Dad MCP server:", err);
        process.exit(1);
      }
    });
}
