import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigLoader } from "../../src/config/loader";
import { ConsultDadConfigSchema } from "../../src/config/schema";
import { ConfigTrust } from "../../src/security/config-trust";
import { AdvisorRegistry } from "../../src/core/routing";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Configuration Subsystem & ConfigTrust Integration", () => {
  const testDir = join(tmpdir(), `consult-dad-config-test-${Date.now()}`);
  const trustDbPath = join(testDir, ".approvals.json");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("validates default configuration schema correctly", () => {
    const parsed = ConsultDadConfigSchema.parse({});
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.default_advisor).toBe("staff");
    expect(parsed.timeout_ms).toBe(120_000);
    expect(parsed.escalation.max_attempts_before_consult).toBe(2);
    expect(parsed.escalation.max_consultations_per_task).toBe(3);
    expect(parsed.escalation.max_depth).toBe(1);
  });

  it("loads default config when no config files exist", () => {
    const trust = new ConfigTrust(trustDbPath);
    const loader = new ConfigLoader({
      workspaceRoot: testDir,
      globalConfigPath: join(testDir, "nonexistent-global.json"),
      configTrust: trust,
    });

    const result = loader.load();
    expect(result.isProjectConfig).toBe(false);
    expect(result.config.default_advisor).toBe("staff");
  });

  it("detects and flags unapproved project config", () => {
    const projectDir = join(testDir, "my-repo");
    const consultDadDir = join(projectDir, ".consult-dad");
    mkdirSync(consultDadDir, { recursive: true });

    const configPath = join(consultDadDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: "1.0.0",
        default_advisor: "custom-staff",
        advisors: {
          "custom-staff": {
            adapter: "fake",
            priority: 200,
          },
        },
      })
    );

    const trust = new ConfigTrust(trustDbPath);
    const loader = new ConfigLoader({
      workspaceRoot: projectDir,
      configTrust: trust,
      strictTrust: true,
    });

    const result = loader.load();
    // In strictTrust mode, unapproved config is skipped
    expect(result.isProjectConfig).toBe(false);
    expect(result.config.default_advisor).toBe("staff");
  });

  it("loads approved project config and applies custom advisors to registry", async () => {
    const projectDir = join(testDir, "my-approved-repo");
    const consultDadDir = join(projectDir, ".consult-dad");
    mkdirSync(consultDadDir, { recursive: true });

    const configPath = join(consultDadDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: "1.0.0",
        default_advisor: "custom-advisor",
        advisors: {
          "custom-advisor": {
            adapter: "fake",
            priority: 150,
            capabilities: ["architecture", "debugging"],
          },
        },
      })
    );

    const trust = new ConfigTrust(trustDbPath);
    trust.approve(configPath);

    const loader = new ConfigLoader({
      workspaceRoot: projectDir,
      configTrust: trust,
      strictTrust: true,
    });

    const result = loader.load();
    expect(result.isProjectConfig).toBe(true);
    expect(result.config.default_advisor).toBe("custom-advisor");

    const registry = new AdvisorRegistry();
    loader.applyToRegistry(result.config, registry);

    const advisorList = await registry.list();
    expect(advisorList.length).toBe(1);
    expect(advisorList[0].id).toBe("custom-advisor");
    expect(advisorList[0].priority).toBe(150);
  });
});
