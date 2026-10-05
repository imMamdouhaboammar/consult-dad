const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /sk-ant-[a-zA-Z0-9_-]{20,}/g,
  /sk-proj-[a-zA-Z0-9_-]{20,}/g,
  /ghp_[a-zA-Z0-9]{30,}/g,
  /gho_[a-zA-Z0-9]{30,}/g,
  /ghu_[a-zA-Z0-9]{30,}/g,
  /ghs_[a-zA-Z0-9]{30,}/g,
  /glpat-[a-zA-Z0-9_-]{20,}/g,
  /Bearer\s+[a-zA-Z0-9_\-.]{20,}/gi,
  /xox[baprs]-[0-9a-zA-Z]{10,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /postgres:\/\/[^:]+:[^@]+@[^/]+/gi,
  /mysql:\/\/[^:]+:[^@]+@[^/]+/gi,
  /mongodb(\+srv)?:\/\/[^:]+:[^@]+@[^/]+/gi,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
];

export class RedactionService {
  sanitizeText(text: string): string {
    if (!text) return text;

    let sanitized = text;
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
    return sanitized;
  }

  sanitizeValue<T>(value: T): T {
    return this.sanitizeUnknown(value) as T;
  }

  private sanitizeUnknown(value: unknown): unknown {
    if (typeof value === "string") {
      return this.sanitizeText(value);
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.sanitizeUnknown(entry));
    }

    if (value !== null && typeof value === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) {
        const safeKey = this.allocateUniqueKey(this.sanitizeText(key), sanitized);
        sanitized[safeKey] = this.sanitizeUnknown(entry);
      }
      return sanitized;
    }

    return value;
  }

  private allocateUniqueKey(
    preferredKey: string,
    target: Record<string, unknown>
  ): string {
    if (!(preferredKey in target)) {
      return preferredKey;
    }

    let suffix = 2;
    let candidate = `${preferredKey}#${suffix}`;
    while (candidate in target) {
      suffix += 1;
      candidate = `${preferredKey}#${suffix}`;
    }
    return candidate;
  }
}
