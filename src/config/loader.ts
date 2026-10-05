import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ConsultDadConfig, ConsultDadConfigSchema } from "./schema";
import { ConfigTrust, TrustCheckResult } from "../security/config-trust";
import { AdvisorRegistry } from "../core/routing";
import { CodexAdapter } from "../adapters/codex";
import { ClaudeAdapter } from "../adapters/claude";
import { GenericCommandAdapter } from "../adapters/generic-command";
import { FakeAdvisorAdapter } from "../adapters/fake";
import { AdvisorAdapter } from "../adapters/adapter";

export interface ConfigLoaderOptions {
  workspaceRoot?: string;
  globalConfigPath?: string;
  configTrust?: ConfigTrust;
}

export interface LoadedConfigResult {
  config: ConsultDadConfig;
  configPath?: string;
  isProjectConfig: boolean;
  trustResult?: TrustCheckResult;
}

export class ConfigLoader {
  private workspaceRoot: string;
  private globalConfigPath: string;
  private configTrust: ConfigTrust;

  constructor(options: ConfigLoaderOptions = {}) {
    this.workspaceRoot = resolve(options.workspaceRoot || process.cwd());
    this.globalConfigPath =
      options.globalConfigPath ||
      join(process.env.HOME || "", ".config/consult-dad/config.json");
    this.configTrust = options.configTrust || new ConfigTrust();
  }

  load(): LoadedConfigResult {
    const projectConfigPath = join(this.workspaceRoot, ".consult-dad/config.json");

    if (existsSync(projectConfigPath)) {
      let rawContent: string;

      try {
        rawContent = readFileSync(projectConfigPath, "utf-8");
      } catch (err: any) {
        console.error(
          `[consult-dad] Error reading project config at '${projectConfigPath}': ${err.message}. Ignoring project config and using safe global/default configuration.`
        );
        return this.loadGlobalOrDefault();
      }

      const trust = this.configTrust.checkContent(projectConfigPath, rawContent);
      if (!trust.trusted) {
        console.warn(
          `[consult-dad] Warning: Project config at '${projectConfigPath}' is ${trust.status} and was ignored. Run 'dad trust' to review and approve it. Using safe global/default configuration.`
        );
        return this.loadGlobalOrDefault();
      }

      try {
        const parsedJson = JSON.parse(rawContent);
        const validated = ConsultDadConfigSchema.parse(parsedJson);
        return {
          config: validated,
          configPath: projectConfigPath,
          isProjectConfig: true,
          trustResult: trust,
        };
      } catch (err: any) {
        console.error(
          `[consult-dad] Error parsing approved project config at '${projectConfigPath}': ${err.message}. Ignoring project config and using safe global/default configuration.`
        );
        return this.loadGlobalOrDefault();
      }
    }

    return this.loadGlobalOrDefault();
  }

  private loadGlobalOrDefault(): LoadedConfigResult {
    if (existsSync(this.globalConfigPath)) {
      try {
        const rawContent = readFileSync(this.globalConfigPath, "utf-8");
        const parsedJson = JSON.parse(rawContent);
        const validated = ConsultDadConfigSchema.parse(parsedJson);
        return {
          config: validated,
          configPath: this.globalConfigPath,
          isProjectConfig: false,
        };
      } catch (err: any) {
        console.error(
          `[consult-dad] Error parsing global config at '${this.globalConfigPath}': ${err.message}. Using built-in defaults.`
        );
      }
    }

    const defaultConfig = ConsultDadConfigSchema.parse({});
    return {
      config: defaultConfig,
      isProjectConfig: false,
    };
  }

  applyToRegistry(config: ConsultDadConfig, registry: AdvisorRegistry): void {
    const timeoutMs = config.timeout_ms || 120_000;
    const advisorEntries = Object.entries(config.advisors || {});

    if (advisorEntries.length > 0) {
      for (const [id, advConfig] of advisorEntries) {
        const adapter = this.createAdapter(id, advConfig, timeoutMs);
        registry.register({
          adapter,
          priority: advConfig.priority ?? 100,
          capabilities: advConfig.capabilities && advConfig.capabilities.length > 0
            ? advConfig.capabilities
            : ["architecture", "debugging", "general"],
          description: `Custom configured advisor: ${id} (${advConfig.adapter})`,
        });
      }
    } else {
      const staff = new CodexAdapter({ id: "staff", timeoutMs });
      const architect = new ClaudeAdapter({ id: "architect", timeoutMs });
      const fake = new FakeAdvisorAdapter({ id: "fake-advisor" });

      registry.register({
        adapter: staff,
        priority: 100,
        capabilities: ["architecture", "debugging", "code-review", "concurrency"],
        description: "Codex Staff Engineer",
      });
      registry.register({
        adapter: architect,
        priority: 90,
        capabilities: ["architecture", "design", "tradeoffs", "threat-modeling"],
        description: "Claude Principal Architect",
      });
      registry.register({
        adapter: fake,
        priority: 10,
        capabilities: ["general", "testing"],
        description: "Local Mock Advisor",
      });
    }
  }

  private createAdapter(
    id: string,
    advConfig: { adapter: string; model?: string; command?: string; capabilities?: string[] },
    timeoutMs: number
  ): AdvisorAdapter {
    switch (advConfig.adapter.toLowerCase()) {
      case "codex":
        return new CodexAdapter({
          id,
          model: advConfig.model,
          timeoutMs,
        });
      case "claude":
        return new ClaudeAdapter({
          id,
          model: advConfig.model,
          timeoutMs,
        });
      case "generic-command":
      case "command":
        if (!advConfig.command) {
          throw new Error(`Advisor '${id}' with adapter 'generic-command' requires a 'command' property`);
        }
        return new GenericCommandAdapter({
          id,
          command: advConfig.command,
          capabilities: advConfig.capabilities,
          timeoutMs,
        });
      case "fake":
      case "mock":
        return new FakeAdvisorAdapter({ id });
      default:
        if (advConfig.command) {
          return new GenericCommandAdapter({
            id,
            command: advConfig.command,
            capabilities: advConfig.capabilities,
            timeoutMs,
          });
        }
        throw new Error(`Unsupported adapter type '${advConfig.adapter}' for advisor '${id}'`);
    }
  }
}
