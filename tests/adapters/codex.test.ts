import { describe, it, expect } from "vitest";
import { CodexAdapter } from "../../src/adapters/codex";
import { ClaudeAdapter } from "../../src/adapters/claude";

describe("CLI Adapter Probing", () => {
  it.each([
    ["CodexAdapter", () => new CodexAdapter()],
    ["ClaudeAdapter", () => new ClaudeAdapter()],
  ])("probes binary availability and capabilities for %s", async (_, createAdapter) => {
    const adapter = createAdapter();
    const probe = await adapter.probe();
    expect(typeof probe.available).toBe("boolean");
    expect(typeof probe.supports_read_only).toBe("boolean");
    expect(probe.supports_read_only).toBe(true);
  });
});
