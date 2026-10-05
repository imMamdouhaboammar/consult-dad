import { describe, it, expect } from "vitest";
import { RedactionService } from "../../src/security/redaction";
import { ContextPackBuilder } from "../../src/core/context-builder";

const SECRET = ["ghp_", "synthetic", "credential", "fixture", "only", "1234567890"].join("");

describe("RedactionService", () => {
  it("sanitizes nested structured values without mutating caller-owned input", () => {
    const redactor = new RedactionService();
    const input = {
      message: `token=${SECRET}`,
      nested: {
        values: [`Bearer ${"a".repeat(32)}`, 42, true, null],
      },
    };

    const sanitized = redactor.sanitizeValue(input);

    expect(JSON.stringify(sanitized)).not.toContain(SECRET);
    expect(JSON.stringify(sanitized)).toContain("[REDACTED]");
    expect(input.message).toContain(SECRET);
    expect(sanitized).not.toBe(input);
    expect(sanitized.nested).not.toBe(input.nested);
  });

  it("sanitizes secret-bearing object keys without losing colliding entries", () => {
    const redactor = new RedactionService();
    const secretA = SECRET;
    const secretB = ["ghp_", "another", "synthetic", "credential", "fixture", "1234567890"].join("");
    const input = {
      [`token-${secretA}`]: "first",
      [`token-${secretB}`]: "second",
      safe: "third",
    };

    const sanitized = redactor.sanitizeValue(input);
    const serialized = JSON.stringify(sanitized);
    const keys = Object.keys(sanitized);

    expect(serialized).not.toContain(secretA);
    expect(serialized).not.toContain(secretB);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(Object.values(sanitized).sort()).toEqual(["first", "second", "third"]);
  });

  it("is idempotent for already-redacted content", () => {
    const redactor = new RedactionService();
    const once = redactor.sanitizeText(`token=${SECRET}`);
    const twice = redactor.sanitizeText(once);

    expect(once).toBe("token=[REDACTED]");
    expect(twice).toBe(once);
  });

  it("is the policy used by ContextPackBuilder prompt redaction", () => {
    const redactor = new RedactionService();
    const builder = new ContextPackBuilder();
    const text = `diagnostic credential ${SECRET}`;

    expect(builder.redact(text)).toBe(redactor.sanitizeText(text));
    expect(builder.redact(text)).not.toContain(SECRET);
  });
});
