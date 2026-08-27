import { Command } from "commander";
import { AdvisorRegistry } from "../core/routing";
import { OutputFormatter } from "./output";

export function createAdvisorsCommand(registry: AdvisorRegistry): Command {
  return new Command("advisors")
    .description("List all registered Dad advisors and their availability")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: any) => {
      try {
        const advisors = await registry.list();
        if (options.json) {
          console.log(JSON.stringify(advisors, null, 2));
        } else {
          console.log(`\n=== Registered Advisors (${advisors.length}) ===\n`);
          advisors.forEach((adv) => {
            const statusIcon = adv.availability.available ? "🟢 Available" : "🔴 Unavailable";
            console.log(`• ${adv.id} (Priority: ${adv.priority}) — ${statusIcon}`);
            if (adv.capabilities.length > 0) {
              console.log(`  Capabilities: ${adv.capabilities.join(", ")}`);
            }
            console.log(`  Read-only: ${adv.availability.supports_read_only}, Resume: ${adv.availability.supports_resume}`);
            console.log();
          });
        }
      } catch (err: any) {
        OutputFormatter.formatError(err, options.json);
        process.exitCode = 1;
      }
    });
}
