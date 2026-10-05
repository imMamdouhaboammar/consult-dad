import { Database } from "bun:sqlite";
import { ulid } from "ulid";
import {
  ConsultationRequest,
  ConsultationAnswer,
  ConsultationState,
  ConsultationStatus,
  ConsultationEvent,
  ConsultationMode,
} from "../core/protocol";
import { runMigrations } from "./migrations";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { RedactionService } from "../security/redaction";

export interface ListFilter {
  status?: ConsultationStatus;
  contextId?: string;
  callerId?: string;
  limit?: number;
}

export class ConsultationStore {
  private db: Database;

  constructor(
    dbPath: string = ":memory:",
    private redactor: RedactionService = new RedactionService()
  ) {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    runMigrations(this.db);
  }

  create(request: ConsultationRequest, contextId?: string): string {
    const safeRequest = this.redactor.sanitizeValue(request);
    const id = request.consultation_id || `dad_${ulid()}`;
    const startedAt = new Date().toISOString();
    const callerId = safeRequest.caller.agent;
    const mode = safeRequest.mode;
    const status: ConsultationStatus = "created";

    const query = this.db.prepare(`
      INSERT INTO consultations (
        consultation_id, context_id, advisor_id, native_session_id,
        caller_id, mode, status, started_at, request_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    query.run(
      id,
      contextId || null,
      null,
      null,
      callerId,
      mode,
      status,
      startedAt,
      JSON.stringify(safeRequest)
    );

    return id;
  }

  get(id: string): ConsultationState | null {
    const row = this.db
      .prepare(`SELECT * FROM consultations WHERE consultation_id = ?`)
      .get(id) as any;

    if (!row) return null;

    const eventsRows = this.db
      .prepare(
        `SELECT timestamp, type, detail FROM consultation_events WHERE consultation_id = ? ORDER BY id ASC`
      )
      .all(id) as any[];

    const artifactsRows = this.db
      .prepare(`SELECT path FROM consultation_artifacts WHERE consultation_id = ?`)
      .all(id) as any[];

    return {
      consultation_id: row.consultation_id,
      context_id: row.context_id || undefined,
      advisor_id: row.advisor_id || undefined,
      native_session_id: row.native_session_id || null,
      caller_id: row.caller_id,
      mode: row.mode as ConsultationMode,
      status: row.status as ConsultationStatus,
      started_at: row.started_at,
      finished_at: row.finished_at || null,
      request: JSON.parse(row.request_json),
      answer: row.answer_json ? JSON.parse(row.answer_json) : null,
      events: eventsRows.map((eventRow) => ({
        timestamp: eventRow.timestamp,
        type: eventRow.type,
        detail: eventRow.detail || undefined,
      })),
      artifacts: artifactsRows.map((artifactRow) => artifactRow.path),
      errors: JSON.parse(row.errors_json || "[]"),
    };
  }

  updateStatus(id: string, status: ConsultationStatus, advisorId?: string, nativeSessionId?: string): void {
    const isFinished = ["completed", "failed", "timed_out", "canceled"].includes(status);
    const finishedAt = isFinished ? new Date().toISOString() : null;

    if (finishedAt) {
      this.db
        .prepare(
          `UPDATE consultations SET status = ?, finished_at = COALESCE(finished_at, ?), advisor_id = COALESCE(?, advisor_id), native_session_id = COALESCE(?, native_session_id) WHERE consultation_id = ?`
        )
        .run(status, finishedAt, advisorId || null, nativeSessionId || null, id);
    } else {
      this.db
        .prepare(
          `UPDATE consultations SET status = ?, advisor_id = COALESCE(?, advisor_id), native_session_id = COALESCE(?, native_session_id) WHERE consultation_id = ?`
        )
        .run(status, advisorId || null, nativeSessionId || null, id);
    }
  }

  saveAnswer(id: string, answer: ConsultationAnswer): void {
    const safeAnswer = this.redactor.sanitizeValue(answer);
    this.db
      .prepare(
        `UPDATE consultations SET answer_json = ?, status = 'completed', finished_at = COALESCE(finished_at, ?) WHERE consultation_id = ?`
      )
      .run(JSON.stringify(safeAnswer), new Date().toISOString(), id);
  }

  appendEvent(id: string, type: string, detail?: string): void {
    const timestamp = new Date().toISOString();
    const safeDetail = detail ? this.redactor.sanitizeText(detail) : undefined;
    this.db
      .prepare(
        `INSERT INTO consultation_events (consultation_id, timestamp, type, detail) VALUES (?, ?, ?, ?)`
      )
      .run(id, timestamp, type, safeDetail || null);
  }

  recordArtifact(id: string, name: string, path: string): void {
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO consultation_artifacts (consultation_id, name, path, created_at) VALUES (?, ?, ?, ?)`
      )
      .run(id, name, path, createdAt);
  }

  list(filter?: ListFilter): ConsultationState[] {
    let sql = `SELECT consultation_id FROM consultations WHERE 1=1`;
    const params: any[] = [];

    if (filter?.status) {
      sql += ` AND status = ?`;
      params.push(filter.status);
    }
    if (filter?.contextId) {
      sql += ` AND context_id = ?`;
      params.push(filter.contextId);
    }
    if (filter?.callerId) {
      sql += ` AND caller_id = ?`;
      params.push(filter.callerId);
    }

    sql += ` ORDER BY started_at DESC`;

    if (filter?.limit) {
      sql += ` LIMIT ?`;
      params.push(filter.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.get(r.consultation_id)!);
  }

  prune(olderThanIso: string): string[] {
    const rows = this.db
      .prepare(`SELECT consultation_id FROM consultations WHERE started_at < ?`)
      .all(olderThanIso) as any[];
    
    const ids = rows.map((r) => r.consultation_id);
    if (ids.length === 0) return [];

    const deleteStmt = this.db.prepare(`DELETE FROM consultations WHERE started_at < ?`);
    deleteStmt.run(olderThanIso);
    return ids;
  }

  vacuum(): void {
    this.db.exec("VACUUM;");
  }

  close(): void {
    this.db.close();
  }
}
