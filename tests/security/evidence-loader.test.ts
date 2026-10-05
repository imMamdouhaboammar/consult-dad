import { describe, it, expect, afterEach } from "vitest";
import { EvidenceLoader } from "../../src/security/evidence-loader";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("EvidenceLoader", () => {
  const cleanup: string[] = [];

  function makeWorkspace(): string {
    const root = mkdtempSync(join(tmpdir(), "consult-dad-evidence-"));
    cleanup.push(root);
    return root;
  }

  afterEach(() => {
    while (cleanup.length > 0) {
      rmSync(cleanup.pop()!, { recursive: true, force: true });
    }
  });

  it("loads and redacts UTF-8 source files inside the workspace", () => {
    const root = makeWorkspace();
    mkdirSync(join(root, "src"), { recursive: true });
    const secret = ["ghp_", "synthetic", "token", "fixture", "12345678901234567890"].join("");
    writeFileSync(
      join(root, "src", "auth.ts"),
      `export const token = "${secret}";\n`
    );

    const loader = new EvidenceLoader(root);
    const [file] = loader.load(["src/auth.ts"]);

    expect(file.path).toBe("src/auth.ts");
    expect(file.content).toContain("[REDACTED]");
    expect(file.content).not.toContain(secret);
    expect(file.truncated).toBe(false);
  });

  it("deduplicates the same canonical file reached through a symlink", () => {
    const root = makeWorkspace();
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "a.ts"), "export const a = 1;");
    symlinkSync(join(root, "src", "a.ts"), join(root, "alias.ts"));

    const loader = new EvidenceLoader(root);
    const files = loader.load(["src/a.ts", "alias.ts"]);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe("src/a.ts");
  });

  it("rejects missing and binary evidence deterministically", () => {
    const root = makeWorkspace();
    writeFileSync(join(root, "binary.bin"), Buffer.from([0, 1, 2, 3]));

    const loader = new EvidenceLoader(root);
    expect(() => loader.load(["missing.txt"])).toThrow("evidence_file_missing");
    expect(() => loader.load(["binary.bin"])).toThrow("evidence_file_binary");
  });

  it("rejects invalid UTF-8 text with a stable encoding error", () => {
    const root = makeWorkspace();
    writeFileSync(join(root, "invalid.txt"), Buffer.from([0xc3, 0x28]));

    const loader = new EvidenceLoader(root);
    expect(() => loader.load(["invalid.txt"])).toThrow("evidence_file_encoding");
  });

  it("rejects directories as non-file evidence", () => {
    const root = makeWorkspace();
    mkdirSync(join(root, "folder"), { recursive: true });

    const loader = new EvidenceLoader(root);
    expect(() => loader.load(["folder"])).toThrow("evidence_file_invalid");
  });

  it("truncates oversized files to the per-file byte budget", () => {
    const root = makeWorkspace();
    writeFileSync(join(root, "large.txt"), "abcdefghijklmnopqrstuvwxyz");

    const loader = new EvidenceLoader(root, {
      maxFileBytes: 10,
      maxTotalBytes: 100,
    });
    const [file] = loader.load(["large.txt"]);

    expect(file.bytes_read).toBe(10);
    expect(file.content).toBe("abcdefghij");
    expect(file.truncated).toBe(true);
  });

  it("shares one total byte budget across successive load calls", () => {
    const root = makeWorkspace();
    writeFileSync(join(root, "one.txt"), "abcdefghij");
    writeFileSync(join(root, "two.txt"), "klmnopqrst");

    const loader = new EvidenceLoader(root, {
      maxFileBytes: 10,
      maxTotalBytes: 15,
    });

    const [first] = loader.load(["one.txt"]);
    const [second] = loader.load(["two.txt"]);

    expect(first.bytes_read).toBe(10);
    expect(first.truncated).toBe(false);
    expect(second.bytes_read).toBe(5);
    expect(second.content).toBe("klmno");
    expect(second.truncated).toBe(true);
    expect(() => loader.load(["three.txt"])).toThrow();
  });
});
