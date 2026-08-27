import { Command } from "commander";
import { ConfigTrust } from "../security/config-trust";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

export function createTrustCommand(): Command {
  return new Command("trust")
    .description("Approve or verify the SHA-256 hash of project configuration (.consult-dad/config.json)")
    .argument("[configPath]", "Path to config file", ".consult-dad/config.json")
    .option("--check", "Only check trust status without approving", false)
    .option("--json", "Output machine-readable JSON")
    .action(async (configPathArg: string, options: any) => {
      try {
        const trust = new ConfigTrust();
        const targetPath = resolve(process.cwd(), configPathArg);

        if (!existsSync(targetPath)) {
          throw new Error(`Configuration file '${targetPath}' not found`);
        }

        if (options.check) {
          const checkResult = trust.check(targetPath);
          if (options.json) {
            console.log(JSON.stringify(checkResult, null, 2));
          } else {
            console.log(`\nConfig Trust Check:`);
            console.log(`  File:   ${checkResult.configPath}`);
            console.log(`  Status: ${checkResult.status.toUpperCase()}`);
            console.log(`  Hash:   ${checkResult.actualHash || "none"}`);
            console.log(`  Result: ${checkResult.trusted ? "🟢 TRUSTED" : "🔴 UNTRUSTED / ACTION NEEDED"}\n`);
          }
          if (!checkResult.trusted) {
            process.exitCode = 1;
          }
          return;
        }

        const approvedHash = trust.approve(targetPath);
        if (options.json) {
          console.log(JSON.stringify({ status: "approved", configPath: targetPath, hash: approvedHash }, null, 2));
        } else {
          console.log(`\n✓ Config Approved:`);
          console.log(`  File: ${targetPath}`);
          console.log(`  SHA-256 Hash: ${approvedHash}\n`);
        }
      } catch (err: unknown) {
        if (options.json) {
          console.error(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2));
        } else {
          console.error(`\n❌ Error: ${err instanceof Error ? err.message : String(err)}\n`);
        }
        process.exitCode = 1;
      }
    });
}
