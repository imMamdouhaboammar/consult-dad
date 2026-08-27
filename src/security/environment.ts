const ALLOWED_ENV_VARS = new Set([
  "PATH",
  "TERM",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SHELL",
  "HOME",
  "USER",
  "TMPDIR",
  "TMP",
  "TEMP",
]);

const SENSITIVE_PATTERNS = [
  /SECRET/i,
  /KEY/i,
  /TOKEN/i,
  /PASSWORD/i,
  /AUTH/i,
  /CREDENTIAL/i,
  /PRIVATE/i,
];

export class EnvironmentCleaner {
  static clean(sourceEnv: Record<string, string | undefined> = process.env): Record<string, string> {
    const cleaned: Record<string, string> = {};

    for (const [key, value] of Object.entries(sourceEnv)) {
      if (!value) continue;

      // Filter out sensitive substrings in key names
      const isSensitiveKey = SENSITIVE_PATTERNS.some((p) => p.test(key));
      if (isSensitiveKey && !ALLOWED_ENV_VARS.has(key)) {
        continue;
      }

      if (ALLOWED_ENV_VARS.has(key) || key.startsWith("DAD_") || key.startsWith("NODE_")) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }
}
