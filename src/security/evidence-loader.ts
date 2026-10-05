import {
  closeSync,
  existsSync,
  openSync,
  readSync,
  statSync,
} from "node:fs";
import { relative } from "node:path";
import { WorkspaceGuard } from "./workspace";
import { RedactionService } from "./redaction";

export interface EvidenceLoaderOptions {
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export interface LoadedEvidenceFile {
  path: string;
  content: string;
  truncated: boolean;
  bytes_read: number;
}

export const DEFAULT_EVIDENCE_FILE_BYTES = 16 * 1024;
export const DEFAULT_EVIDENCE_TOTAL_BYTES = 48 * 1024;

export class EvidenceLoader {
  private guard: WorkspaceGuard;
  private redactor: RedactionService;
  private maxFileBytes: number;
  private maxTotalBytes: number;
  private totalBytesRead = 0;
  private seenCanonicalPaths = new Set<string>();

  constructor(
    workspaceRoot: string,
    options: EvidenceLoaderOptions = {}
  ) {
    this.guard = new WorkspaceGuard(workspaceRoot);
    this.redactor = new RedactionService();
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_EVIDENCE_FILE_BYTES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_EVIDENCE_TOTAL_BYTES;
  }

  load(paths: string[]): LoadedEvidenceFile[] {
    const loaded: LoadedEvidenceFile[] = [];

    for (const requestedPath of paths) {
      const item = this.loadOne(requestedPath);
      if (item) loaded.push(item);
    }

    return loaded;
  }

  private loadOne(requestedPath: string): LoadedEvidenceFile | null {
    if (!requestedPath || !requestedPath.trim()) {
      throw new Error("evidence_file_invalid: Evidence path must not be empty");
    }

    const canonicalPath = this.guard.assertPathWithinWorkspace(requestedPath);

    if (!existsSync(canonicalPath)) {
      throw new Error(
        `evidence_file_missing: Evidence file '${requestedPath}' does not exist`
      );
    }

    if (this.seenCanonicalPaths.has(canonicalPath)) {
      return null;
    }

    let stat;
    try {
      stat = statSync(canonicalPath);
    } catch {
      throw new Error(
        `evidence_file_unreadable: Evidence file '${requestedPath}' cannot be inspected`
      );
    }

    if (!stat.isFile()) {
      throw new Error(
        `evidence_file_invalid: Evidence path '${requestedPath}' is not a regular file`
      );
    }

    const remaining = this.maxTotalBytes - this.totalBytesRead;
    if (remaining <= 0) {
      throw new Error(
        `context_too_large: Evidence total byte budget (${this.maxTotalBytes}) exhausted before '${requestedPath}'`
      );
    }

    const bytesToRead = Math.min(
      stat.size,
      this.maxFileBytes,
      remaining
    );
    const truncated = stat.size > bytesToRead;
    const buffer = Buffer.alloc(bytesToRead);
    let fd: number | null = null;
    let bytesRead = 0;

    try {
      fd = openSync(canonicalPath, "r");
      bytesRead = readSync(fd, buffer, 0, bytesToRead, 0);
    } catch {
      throw new Error(
        `evidence_file_unreadable: Evidence file '${requestedPath}' cannot be read`
      );
    } finally {
      if (fd !== null) closeSync(fd);
    }

    const slice = buffer.subarray(0, bytesRead);
    if (slice.includes(0)) {
      throw new Error(
        `evidence_file_binary: Evidence file '${requestedPath}' appears to be binary`
      );
    }

    const decoded = this.decodeUtf8(slice, truncated, requestedPath);
    const root = this.guard.getCanonicalRoot();
    const displayPath = relative(root, canonicalPath).replaceAll("\\", "/") || ".";

    this.totalBytesRead += bytesRead;
    this.seenCanonicalPaths.add(canonicalPath);

    return {
      path: displayPath,
      content: this.redactor.sanitizeText(decoded),
      truncated,
      bytes_read: bytesRead,
    };
  }

  private decodeUtf8(
    buffer: Buffer,
    truncated: boolean,
    requestedPath: string
  ): string {
    const decoder = new TextDecoder("utf-8", { fatal: true });

    if (!truncated) {
      try {
        return decoder.decode(buffer);
      } catch {
        throw new Error(
          `evidence_file_encoding: Evidence file '${requestedPath}' is not valid UTF-8 text`
        );
      }
    }

    for (let trim = 0; trim <= Math.min(3, buffer.length); trim++) {
      try {
        const end = trim === 0 ? buffer.length : buffer.length - trim;
        return new TextDecoder("utf-8", { fatal: true }).decode(
          buffer.subarray(0, end)
        );
      } catch {
        // A bounded read may split a multi-byte code point at the end.
      }
    }

    throw new Error(
      `evidence_file_encoding: Evidence file '${requestedPath}' is not valid UTF-8 text`
    );
  }
}
