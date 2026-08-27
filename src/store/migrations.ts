import { Database } from "bun:sqlite";

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS consultations (
      consultation_id TEXT PRIMARY KEY,
      context_id TEXT,
      advisor_id TEXT,
      native_session_id TEXT,
      caller_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      request_json TEXT NOT NULL,
      answer_json TEXT,
      errors_json TEXT DEFAULT '[]'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consultation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultation_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      detail TEXT,
      FOREIGN KEY(consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consultation_artifacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultation_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(consultation_id) REFERENCES consultations(consultation_id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_consultations_context ON consultations(context_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_consultation ON consultation_events(consultation_id)`);
}
