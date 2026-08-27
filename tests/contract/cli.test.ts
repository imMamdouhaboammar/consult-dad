import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCli } from "../../src/cli/index";
import { ConsultationStore } from "../../src/store/sqlite";
import { ArtifactStore } from "../../src/store/artifacts";
import { AdvisorRegistry } from "../../src/core/routing";
import { FakeAdvisorAdapter } from "../../src/adapters/fake";
import { ConsultationBroker } from "../../src/broker/broker";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync, rmSync } from "node:fs";

describe("Consult Dad CLI", () => {
  let testDbPath: string;
  let testDir: string;
  let store: ConsultationStore;
  let artifactStore: ArtifactStore;
  let registry: AdvisorRegistry;
  let broker: ConsultationBroker;
  let fakeAdapter: FakeAdvisorAdapter;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDir = join(tmpdir(), `test-cli-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    store = new ConsultationStore(testDbPath);
    artifactStore = new ArtifactStore(testDir);
    fakeAdapter = new FakeAdvisorAdapter({ id: "staff", customVerdict: "CLI Advice Verdict" });
    registry = new AdvisorRegistry();
    registry.register({ adapter: fakeAdapter, priority: 100, capabilities: ["general"] });

    broker = new ConsultationBroker({
      store,
      artifactStore,
      defaultAdapter: fakeAdapter,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {}
    if (existsSync(testDbPath)) rmSync(testDbPath, { force: true });
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it("registers all expected subcommands", () => {
    const cli = createCli({ store, artifactStore, registry, broker });
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
  });

  it("executes ask command and produces consultation answer", async () => {
    const cli = createCli({ store, artifactStore, registry, broker });

    let loggedOutput = "";
    const originalLog = console.log;
    console.log = (...args) => {
      loggedOutput += args.join(" ") + "\n";
    };

    try {
      await cli.parseAsync(["node", "dad", "ask", "How to fix test race?", "--json"]);
      expect(loggedOutput).toContain("CLI Advice Verdict");
      expect(loggedOutput).toContain("consult-dad.answer.v1");
    } finally {
      console.log = originalLog;
    }
  });

  it("executes doctor command and reports healthy runtime", async () => {
    const cli = createCli({ store, artifactStore, registry, broker });

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
});
