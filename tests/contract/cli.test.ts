import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCli } from "../../src/cli/index";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationBroker } from "../../src/broker/broker";
import { ConfigTrust } from "../../src/security/config-trust";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";

describe("Consult Dad CLI", () => {
  let testDbPath: string;
  let testDir: string;
  let workspaceDir: string;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let fakeAdapter: FakeAdvisorAdapter;
  let trust: ConfigTrust;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-cli-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    workspaceDir = join(tmpdir(), `test-cli-ws-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(workspaceDir, { recursive: true });

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    fakeAdapter = new FakeAdvisorAdapter({ id: "staff", customVerdict: "CLI Advice Verdict" });
    registry = new AdvisorRegistry();
    registry.register({ adapter: fakeAdapter, priority: 100, capabilities: ["general", "debugging"] });

    broker = new ConsultationBroker({
      store,
      artifactStore,
      defaultAdapter: fakeAdapter,
      registry,
    });

    trust = new ConfigTrust(join(workspaceDir, ".approvals.json"));
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    if (existsSync(workspaceDir)) rmSync(workspaceDir, { recursive: true, force: true });
  });

  it("registers all expected subcommands", () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });
    const commandNames = cli.commands.map((command) => command.name());

    expect(commandNames).toContain("ask");
    expect(commandNames).toContain("followup");
    expect(commandNames).toContain("status");
    expect(commandNames).toContain("result");
    expect(commandNames).toContain("cancel");
    expect(commandNames).toContain("advisors");
    expect(commandNames).toContain("doctor");
    expect(commandNames).toContain("serve");
    expect(commandNames).toContain("trust");
    expect(commandNames).toContain("init");
    expect(commandNames).toContain("logs");
    expect(commandNames).toContain("prune");
  });


  it("ignores unapproved project advisor configuration at CLI composition", async () => {
    const configDir = join(workspaceDir, ".consult-dad");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        version: "1.0.0",
        default_advisor: "repo-controlled",
        advisors: {
          "repo-controlled": {
            adapter: "fake",
            priority: 999,
            capabilities: ["general"],
          },
        },
      })
    );

    const cli = createCli({
      store,
      artifactStore,
      configTrust: trust,
      workspaceRoot: workspaceDir,
    });

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync(["node", "dad", "advisors", "--json"]);
      const parsed = JSON.parse(loggedOutput);
      expect(parsed.some((advisor: any) => advisor.id === "repo-controlled")).toBe(false);
      expect(parsed.some((advisor: any) => advisor.id === "staff")).toBe(true);
      expect(parsed.some((advisor: any) => advisor.id === "fake-advisor")).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  it("rejects --allow-write outside takeover mode with actionable guidance", async () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });
    const previousExitCode = process.exitCode;
    let errorOutput = "";
    const originalError = console.error;
    console.error = (...args) => {
      errorOutput += args.join(" ") + "\n";
    };
    process.exitCode = undefined;

    try {
      await cli.parseAsync([
        "node",
        "dad",
        "ask",
        "--allow-write",
        "-m",
        "diagnose",
        "Should this be writable?",
      ]);

      expect(process.exitCode).toBe(1);
      expect(errorOutput.toLowerCase()).toContain("takeover");
      expect(broker.list()).toHaveLength(0);
    } finally {
      console.error = originalError;
      process.exitCode = previousExitCode ?? 0;
    }
  });

  it("attaches bounded source content from --file inside the configured workspace", async () => {
    let capturedRequest: any = null;
    const originalStart = fakeAdapter.start.bind(fakeAdapter);
    fakeAdapter.start = async (request) => {
      capturedRequest = request;
      return originalStart(request);
    };

    const sampleFile = join(workspaceDir, "attached.ts");
    writeFileSync(sampleFile, "export const attachedEvidence = 42;");

    const cli = createCli({
      store,
      artifactStore,
      registry,
      broker,
      configTrust: trust,
      workspaceRoot: workspaceDir,
    });

    const originalLog = console.log;
    console.log = () => {};

    try {
      await cli.parseAsync([
        "node",
        "dad",
        "ask",
        "--file",
        "attached.ts",
        "Review attached source",
      ]);

      expect(capturedRequest?.evidence?.relevant_files).toContain("attached.ts");
      expect(capturedRequest?.evidence?.file_contents?.[0]?.path).toBe("attached.ts");
      expect(capturedRequest?.evidence?.file_contents?.[0]?.content).toContain(
        "attachedEvidence = 42"
      );
    } finally {
      console.log = originalLog;
    }
  });

  it("rejects --log paths outside the configured workspace before consultation", async () => {
    const outsideDir = join(tmpdir(), `test-cli-outside-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(outsideDir, { recursive: true });
    const outsideLog = join(outsideDir, "outside.log");
    writeFileSync(outsideLog, "outside workspace evidence");

    const cli = createCli({
      store,
      artifactStore,
      registry,
      broker,
      configTrust: trust,
      workspaceRoot: workspaceDir,
    });

    const previousExitCode = process.exitCode;
    const originalError = console.error;
    console.error = () => {};
    process.exitCode = 0;

    try {
      await cli.parseAsync([
        "node",
        "dad",
        "ask",
        "--log",
        outsideLog,
        "Read outside log",
      ]);

      expect(process.exitCode).toBe(1);
      expect(broker.list()).toHaveLength(0);
    } finally {
      console.error = originalError;
      process.exitCode = previousExitCode ?? 0;
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("executes ask command with file and test arguments", async () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });

    const sampleFile = join(workspaceDir, "mutex.ts");
    writeFileSync(sampleFile, "export class Mutex {}");

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync([
        "node",
        "dad",
        "ask",
        "-f",
        sampleFile,
        "--test",
        "mutex.test.ts",
        "-m",
        "diagnose",
        "--hypothesis",
        "Lock ordering issue",
        "How to resolve deadlock?",
        "--json",
      ]);
      expect(loggedOutput).toContain("CLI Advice Verdict");
      expect(loggedOutput).toContain("consult-dad.answer.v1");
    } finally {
      console.log = originalLog;
    }
  });

  it("executes doctor command and reports healthy runtime", async () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync(["node", "dad", "doctor", "--json"]);
      const parsed = JSON.parse(loggedOutput);
      expect(parsed.healthy).toBe(true);
      expect(parsed.database).toBe("healthy");
    } finally {
      console.log = originalLog;
    }
  });

  it("executes logs command on an existing consultation", async () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });
    const id = await broker.consult({
      mode: "diagnose",
      caller: { agent: "test-agent", role: "worker" },
      goal: "Test logs command",
      question: "Why logs?",
      decision_needed: "Logs needed",
    });

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync(["node", "dad", "logs", id, "--json"]);
      const parsed = JSON.parse(loggedOutput);
      expect(parsed.consultation_id).toBe(id);
      expect(parsed.status).toBe("completed");
      expect(parsed.events.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });

  it("executes prune command to clean historical data", async () => {
    const cli = createCli({ store, artifactStore, registry, broker, configTrust: trust });

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync(["node", "dad", "prune", "--days", "0", "--json"]);
      const parsed = JSON.parse(loggedOutput);
      expect(parsed.status).toBe("pruned");
      expect(parsed.days).toBe(0);
    } finally {
      console.log = originalLog;
    }
  });
});
