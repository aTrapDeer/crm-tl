import { turso } from "./turso";
import { getBonanReportById } from "./bonan-reports";

export type BonanReportSignatureScope = "daily_walkthrough" | "fire_alarm";

export interface BonanReportSignature {
  id: string;
  bonan_report_id: string;
  signature_scope: BonanReportSignatureScope;
  signer_name: string;
  signer_title: string | null;
  signature_data: string;
  signed_by: string | null;
  signed_date: string;
  signed_at: string;
  ip_address: string | null;
  created_at: string;
}

let bonanReportSignaturesReady = false;
let bonanReportSignaturesReadyPromise: Promise<void> | null = null;

function mapRowToBonanReportSignature(
  row: Record<string, unknown>
): BonanReportSignature {
  return {
    id: row.id as string,
    bonan_report_id: row.bonan_report_id as string,
    signature_scope: row.signature_scope as BonanReportSignatureScope,
    signer_name: row.signer_name as string,
    signer_title: row.signer_title as string | null,
    signature_data: row.signature_data as string,
    signed_by: row.signed_by as string | null,
    signed_date: row.signed_date as string,
    signed_at: row.signed_at as string,
    ip_address: row.ip_address as string | null,
    created_at: row.created_at as string,
  };
}

async function ensureBonanReportSignaturesTable(): Promise<void> {
  if (bonanReportSignaturesReady) return;
  if (bonanReportSignaturesReadyPromise) {
    await bonanReportSignaturesReadyPromise;
    return;
  }

  bonanReportSignaturesReadyPromise = (async () => {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS bonan_report_signatures (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        bonan_report_id TEXT NOT NULL REFERENCES bonan_reports(id) ON DELETE CASCADE,
        signature_scope TEXT NOT NULL CHECK (signature_scope IN ('daily_walkthrough', 'fire_alarm')),
        signer_name TEXT NOT NULL,
        signer_title TEXT,
        signature_data TEXT NOT NULL,
        signed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        signed_date TEXT NOT NULL DEFAULT (date('now')),
        signed_at TEXT NOT NULL DEFAULT (datetime('now')),
        ip_address TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(bonan_report_id, signature_scope)
      )
    `);

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_bonan_report_signatures_report ON bonan_report_signatures(bonan_report_id)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_bonan_report_signatures_scope ON bonan_report_signatures(signature_scope)"
    );

    bonanReportSignaturesReady = true;
  })();

  try {
    await bonanReportSignaturesReadyPromise;
  } finally {
    bonanReportSignaturesReadyPromise = null;
  }
}

export async function getBonanReportSignatures(
  reportId: string
): Promise<BonanReportSignature[]> {
  await ensureBonanReportSignaturesTable();
  const result = await turso.execute({
    sql: `SELECT * FROM bonan_report_signatures
          WHERE bonan_report_id = ?
          ORDER BY created_at ASC`,
    args: [reportId],
  });
  return result.rows.map(mapRowToBonanReportSignature);
}

export async function upsertBonanReportSignature(data: {
  bonan_report_id: string;
  signature_scope: BonanReportSignatureScope;
  signer_name: string;
  signer_title?: string | null;
  signature_data: string;
  signed_by?: string | null;
  ip_address?: string | null;
}): Promise<BonanReportSignature> {
  await ensureBonanReportSignaturesTable();
  const report = await getBonanReportById(data.bonan_report_id);
  if (!report) {
    throw new Error("Bonan report not found");
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  await turso.execute({
    sql: `INSERT INTO bonan_report_signatures (
            id,
            bonan_report_id,
            signature_scope,
            signer_name,
            signer_title,
            signature_data,
            signed_by,
            signed_date,
            signed_at,
            ip_address
          ) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'), datetime('now'), ?)
          ON CONFLICT(bonan_report_id, signature_scope) DO UPDATE SET
            signer_name = excluded.signer_name,
            signer_title = excluded.signer_title,
            signature_data = excluded.signature_data,
            signed_by = excluded.signed_by,
            signed_date = excluded.signed_date,
            signed_at = excluded.signed_at,
            ip_address = excluded.ip_address`,
    args: [
      id,
      data.bonan_report_id,
      data.signature_scope,
      data.signer_name,
      data.signer_title || null,
      data.signature_data,
      data.signed_by || null,
      data.ip_address || null,
    ],
  });

  const signatures = await getBonanReportSignatures(data.bonan_report_id);
  const signature = signatures.find(
    (entry) => entry.signature_scope === data.signature_scope
  );
  if (!signature) {
    throw new Error("Failed to save Bonan report signature");
  }
  return signature;
}
