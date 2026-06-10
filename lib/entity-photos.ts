import { turso } from "./turso";

export type EntityPhotoType = "work_order" | "incident_report" | "estimate_line_item";
export type EntityPhotoRole = "before" | "after" | "general";

export interface EntityPhoto {
  id: string;
  entity_type: EntityPhotoType;
  entity_id: string;
  photo_role: EntityPhotoRole;
  filename: string;
  s3_key: string | null;
  s3_url: string | null;
  caption: string | null;
  captured_at: string;
  uploaded_by: string | null;
  uploader_name?: string;
  created_at: string;
}

let entityPhotosReady = false;
let entityPhotosReadyPromise: Promise<void> | null = null;

function mapRowToEntityPhoto(row: Record<string, unknown>): EntityPhoto {
  return {
    id: row.id as string,
    entity_type: row.entity_type as EntityPhotoType,
    entity_id: row.entity_id as string,
    photo_role: row.photo_role as EntityPhotoRole,
    filename: row.filename as string,
    s3_key: row.s3_key as string | null,
    s3_url: row.s3_url as string | null,
    caption: row.caption as string | null,
    captured_at: row.captured_at as string,
    uploaded_by: row.uploaded_by as string | null,
    uploader_name: row.uploader_name as string | undefined,
    created_at: row.created_at as string,
  };
}

async function ensureEntityPhotosTable(): Promise<void> {
  if (entityPhotosReady) return;
  if (entityPhotosReadyPromise) {
    await entityPhotosReadyPromise;
    return;
  }

  entityPhotosReadyPromise = (async () => {
    const existing = await turso.execute({
      sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'entity_photos'",
    });
    const existingSql = existing.rows[0]?.sql as string | undefined;
    if (existingSql && !existingSql.includes("estimate_line_item")) {
      await turso.execute("ALTER TABLE entity_photos RENAME TO entity_photos_old");
      await turso.execute(`
        CREATE TABLE entity_photos (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          entity_type TEXT NOT NULL CHECK (entity_type IN ('work_order', 'incident_report', 'estimate_line_item')),
          entity_id TEXT NOT NULL,
          photo_role TEXT NOT NULL DEFAULT 'general' CHECK (photo_role IN ('before', 'after', 'general')),
          filename TEXT NOT NULL,
          s3_key TEXT,
          s3_url TEXT,
          caption TEXT,
          captured_at TEXT NOT NULL DEFAULT (datetime('now')),
          uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await turso.execute(`
        INSERT INTO entity_photos (
          id, entity_type, entity_id, photo_role, filename, s3_key, s3_url,
          caption, captured_at, uploaded_by, created_at
        )
        SELECT id, entity_type, entity_id, photo_role, filename, s3_key, s3_url,
          caption, captured_at, uploaded_by, created_at
        FROM entity_photos_old
      `);
      await turso.execute("DROP TABLE entity_photos_old");
    }

    await turso.execute(`
      CREATE TABLE IF NOT EXISTS entity_photos (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('work_order', 'incident_report', 'estimate_line_item')),
        entity_id TEXT NOT NULL,
        photo_role TEXT NOT NULL DEFAULT 'general' CHECK (photo_role IN ('before', 'after', 'general')),
        filename TEXT NOT NULL,
        s3_key TEXT,
        s3_url TEXT,
        caption TEXT,
        captured_at TEXT NOT NULL DEFAULT (datetime('now')),
        uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_entity_photos_entity ON entity_photos(entity_type, entity_id)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_entity_photos_role ON entity_photos(entity_type, entity_id, photo_role)"
    );
    await turso.execute(
      "CREATE INDEX IF NOT EXISTS idx_entity_photos_uploaded_by ON entity_photos(uploaded_by)"
    );

    entityPhotosReady = true;
  })();

  try {
    await entityPhotosReadyPromise;
  } finally {
    entityPhotosReadyPromise = null;
  }
}

export async function getEntityPhotos(
  entityType: EntityPhotoType,
  entityId: string
): Promise<EntityPhoto[]> {
  await ensureEntityPhotosTable();
  const result = await turso.execute({
    sql: `SELECT ep.*, u.first_name || ' ' || u.last_name AS uploader_name
          FROM entity_photos ep
          LEFT JOIN users u ON u.id = ep.uploaded_by
          WHERE ep.entity_type = ?
            AND ep.entity_id = ?
          ORDER BY
            CASE ep.photo_role
              WHEN 'before' THEN 0
              WHEN 'after' THEN 1
              ELSE 2
            END ASC,
            ep.captured_at DESC,
            ep.created_at DESC`,
    args: [entityType, entityId],
  });
  return result.rows.map(mapRowToEntityPhoto);
}

export async function addEntityPhoto(data: {
  entity_type: EntityPhotoType;
  entity_id: string;
  photo_role?: EntityPhotoRole;
  filename: string;
  s3_key?: string | null;
  s3_url?: string | null;
  caption?: string | null;
  captured_at?: string | null;
  uploaded_by?: string | null;
}): Promise<EntityPhoto> {
  await ensureEntityPhotosTable();
  const id = crypto.randomUUID().replace(/-/g, "");
  const capturedAt = data.captured_at || new Date().toISOString();

  await turso.execute({
    sql: `INSERT INTO entity_photos (
            id,
            entity_type,
            entity_id,
            photo_role,
            filename,
            s3_key,
            s3_url,
            caption,
            captured_at,
            uploaded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.entity_type,
      data.entity_id,
      data.photo_role || "general",
      data.filename,
      data.s3_key || null,
      data.s3_url || null,
      data.caption || null,
      capturedAt,
      data.uploaded_by || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT ep.*, u.first_name || ' ' || u.last_name AS uploader_name
          FROM entity_photos ep
          LEFT JOIN users u ON u.id = ep.uploaded_by
          WHERE ep.id = ?`,
    args: [id],
  });

  return mapRowToEntityPhoto(result.rows[0]);
}

export async function getEntityPhotoById(photoId: string): Promise<EntityPhoto | null> {
  await ensureEntityPhotosTable();
  const result = await turso.execute({
    sql: `SELECT ep.*, u.first_name || ' ' || u.last_name AS uploader_name
          FROM entity_photos ep
          LEFT JOIN users u ON u.id = ep.uploaded_by
          WHERE ep.id = ?`,
    args: [photoId],
  });

  return result.rows.length > 0 ? mapRowToEntityPhoto(result.rows[0]) : null;
}

export async function deleteEntityPhoto(photoId: string): Promise<EntityPhoto | null> {
  await ensureEntityPhotosTable();
  const photo = await getEntityPhotoById(photoId);
  if (!photo) return null;

  await turso.execute({
    sql: `DELETE FROM entity_photos WHERE id = ?`,
    args: [photoId],
  });

  return photo;
}
