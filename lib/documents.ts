import { turso } from "./turso";

export interface Document {
  id: string;
  filename: string;
  display_name: string;
  description: string | null;
  file_type: string | null;
  file_size: number | null;
  s3_key: string | null;
  s3_url: string | null;
  work_order_id: string | null;
  work_order_number?: string;
  project_id: string | null;
  project_name?: string;
  uploaded_by: string | null;
  uploader_name?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  document_id: string;
  document?: Document;
  client_user_id: string;
  client_name?: string;
  client_email?: string;
  shared_by: string | null;
  sharer_name?: string;
  can_download: boolean;
  expires_at: string | null;
  viewed_at: string | null;
  downloaded_at: string | null;
  created_at: string;
}

function mapRowToDocument(row: Record<string, unknown>): Document {
  return {
    id: row.id as string,
    filename: row.filename as string,
    display_name: row.display_name as string,
    description: row.description as string | null,
    file_type: row.file_type as string | null,
    file_size: row.file_size as number | null,
    s3_key: row.s3_key as string | null,
    s3_url: row.s3_url as string | null,
    work_order_id: row.work_order_id as string | null,
    work_order_number: row.work_order_number as string | undefined,
    project_id: row.project_id as string | null,
    project_name: row.project_name as string | undefined,
    uploaded_by: row.uploaded_by as string | null,
    uploader_name: row.uploader_name as string | undefined,
    is_public: Boolean(row.is_public),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapRowToClientDocument(row: Record<string, unknown>): ClientDocument {
  return {
    id: row.id as string,
    document_id: row.document_id as string,
    client_user_id: row.client_user_id as string,
    client_name: row.client_name as string | undefined,
    client_email: row.client_email as string | undefined,
    shared_by: row.shared_by as string | null,
    sharer_name: row.sharer_name as string | undefined,
    can_download: Boolean(row.can_download),
    expires_at: row.expires_at as string | null,
    viewed_at: row.viewed_at as string | null,
    downloaded_at: row.downloaded_at as string | null,
    created_at: row.created_at as string,
  };
}

// ============ DOCUMENT CRUD ============

export async function getAllDocuments(): Promise<Document[]> {
  const result = await turso.execute(`
    SELECT d.*,
           u.first_name || ' ' || u.last_name as uploader_name,
           wo.work_order_number,
           p.name as project_name
    FROM documents d
    LEFT JOIN users u ON d.uploaded_by = u.id
    LEFT JOIN work_orders wo ON d.work_order_id = wo.id
    LEFT JOIN projects p ON d.project_id = p.id
    ORDER BY d.created_at DESC
  `);
  return result.rows.map(mapRowToDocument);
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const result = await turso.execute({
    sql: `SELECT d.*,
                 u.first_name || ' ' || u.last_name as uploader_name,
                 wo.work_order_number,
                 p.name as project_name
          FROM documents d
          LEFT JOIN users u ON d.uploaded_by = u.id
          LEFT JOIN work_orders wo ON d.work_order_id = wo.id
          LEFT JOIN projects p ON d.project_id = p.id
          WHERE d.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapRowToDocument(result.rows[0]);
}

export async function getDocumentsByWorkOrder(workOrderId: string): Promise<Document[]> {
  const result = await turso.execute({
    sql: `SELECT d.*,
                 u.first_name || ' ' || u.last_name as uploader_name
          FROM documents d
          LEFT JOIN users u ON d.uploaded_by = u.id
          WHERE d.work_order_id = ?
          ORDER BY d.created_at DESC`,
    args: [workOrderId],
  });
  return result.rows.map(mapRowToDocument);
}

export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  const result = await turso.execute({
    sql: `SELECT d.*,
                 u.first_name || ' ' || u.last_name as uploader_name
          FROM documents d
          LEFT JOIN users u ON d.uploaded_by = u.id
          WHERE d.project_id = ?
          ORDER BY d.created_at DESC`,
    args: [projectId],
  });
  return result.rows.map(mapRowToDocument);
}

export async function createDocument(data: {
  filename: string;
  display_name: string;
  description?: string;
  file_type?: string;
  file_size?: number;
  s3_key?: string;
  s3_url?: string;
  work_order_id?: string;
  project_id?: string;
  uploaded_by?: string;
  is_public?: boolean;
}): Promise<Document> {
  const id = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO documents (id, filename, display_name, description, file_type, file_size, s3_key, s3_url, work_order_id, project_id, uploaded_by, is_public)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.filename,
      data.display_name,
      data.description || null,
      data.file_type || null,
      data.file_size || null,
      data.s3_key || null,
      data.s3_url || null,
      data.work_order_id || null,
      data.project_id || null,
      data.uploaded_by || null,
      data.is_public ? 1 : 0,
    ],
  });

  return (await getDocumentById(id))!;
}

export async function updateDocument(
  id: string,
  data: Partial<Pick<Document, "display_name" | "description" | "is_public" | "work_order_id" | "project_id">>
): Promise<Document | null> {
  const updates: string[] = [];
  const args: (string | number | null)[] = [];

  if (data.display_name !== undefined) {
    updates.push("display_name = ?");
    args.push(data.display_name);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    args.push(data.description);
  }
  if (data.is_public !== undefined) {
    updates.push("is_public = ?");
    args.push(data.is_public ? 1 : 0);
  }
  if (data.work_order_id !== undefined) {
    updates.push("work_order_id = ?");
    args.push(data.work_order_id);
  }
  if (data.project_id !== undefined) {
    updates.push("project_id = ?");
    args.push(data.project_id);
  }

  if (updates.length === 0) return getDocumentById(id);

  updates.push("updated_at = datetime('now')");
  args.push(id);

  await turso.execute({
    sql: `UPDATE documents SET ${updates.join(", ")} WHERE id = ?`,
    args,
  });

  return getDocumentById(id);
}

export async function deleteDocument(id: string): Promise<Document | null> {
  const doc = await getDocumentById(id);
  if (!doc) return null;

  await turso.execute({
    sql: `DELETE FROM documents WHERE id = ?`,
    args: [id],
  });

  return doc;
}

// ============ CLIENT DOCUMENT SHARING ============

export async function shareDocumentWithClient(data: {
  document_id: string;
  client_user_id: string;
  shared_by: string;
  can_download?: boolean;
  expires_at?: string;
}): Promise<ClientDocument> {
  const id = crypto.randomUUID().replace(/-/g, "");

  // Use INSERT OR REPLACE to handle re-sharing
  await turso.execute({
    sql: `INSERT OR REPLACE INTO client_documents (id, document_id, client_user_id, shared_by, can_download, expires_at)
          VALUES (
            COALESCE((SELECT id FROM client_documents WHERE document_id = ? AND client_user_id = ?), ?),
            ?, ?, ?, ?, ?
          )`,
    args: [
      data.document_id,
      data.client_user_id,
      id,
      data.document_id,
      data.client_user_id,
      data.shared_by,
      data.can_download !== false ? 1 : 0,
      data.expires_at || null,
    ],
  });

  const result = await turso.execute({
    sql: `SELECT cd.*,
                 u.first_name || ' ' || u.last_name as client_name,
                 u.email as client_email,
                 s.first_name || ' ' || s.last_name as sharer_name
          FROM client_documents cd
          LEFT JOIN users u ON cd.client_user_id = u.id
          LEFT JOIN users s ON cd.shared_by = s.id
          WHERE cd.document_id = ? AND cd.client_user_id = ?`,
    args: [data.document_id, data.client_user_id],
  });

  return mapRowToClientDocument(result.rows[0]);
}

export async function revokeDocumentFromClient(documentId: string, clientUserId: string): Promise<void> {
  await turso.execute({
    sql: `DELETE FROM client_documents WHERE document_id = ? AND client_user_id = ?`,
    args: [documentId, clientUserId],
  });
}

export async function getDocumentShares(documentId: string): Promise<ClientDocument[]> {
  const result = await turso.execute({
    sql: `SELECT cd.*,
                 u.first_name || ' ' || u.last_name as client_name,
                 u.email as client_email,
                 s.first_name || ' ' || s.last_name as sharer_name
          FROM client_documents cd
          LEFT JOIN users u ON cd.client_user_id = u.id
          LEFT JOIN users s ON cd.shared_by = s.id
          WHERE cd.document_id = ?
          ORDER BY cd.created_at DESC`,
    args: [documentId],
  });
  return result.rows.map(mapRowToClientDocument);
}

export async function getDocumentsSharedWithClient(clientUserId: string): Promise<(ClientDocument & { document: Document })[]> {
  const result = await turso.execute({
    sql: `SELECT cd.*,
                 s.first_name || ' ' || s.last_name as sharer_name,
                 d.id as doc_id, d.filename, d.display_name, d.description, d.file_type, d.file_size,
                 d.s3_key, d.s3_url, d.work_order_id, d.project_id, d.uploaded_by, d.is_public,
                 d.created_at as doc_created_at, d.updated_at as doc_updated_at,
                 up.first_name || ' ' || up.last_name as uploader_name,
                 wo.work_order_number,
                 p.name as project_name
          FROM client_documents cd
          INNER JOIN documents d ON cd.document_id = d.id
          LEFT JOIN users s ON cd.shared_by = s.id
          LEFT JOIN users up ON d.uploaded_by = up.id
          LEFT JOIN work_orders wo ON d.work_order_id = wo.id
          LEFT JOIN projects p ON d.project_id = p.id
          WHERE cd.client_user_id = ?
            AND (cd.expires_at IS NULL OR cd.expires_at > datetime('now'))
          ORDER BY cd.created_at DESC`,
    args: [clientUserId],
  });

  return result.rows.map((row) => ({
    ...mapRowToClientDocument(row),
    document: {
      id: row.doc_id as string,
      filename: row.filename as string,
      display_name: row.display_name as string,
      description: row.description as string | null,
      file_type: row.file_type as string | null,
      file_size: row.file_size as number | null,
      s3_key: row.s3_key as string | null,
      s3_url: row.s3_url as string | null,
      work_order_id: row.work_order_id as string | null,
      work_order_number: row.work_order_number as string | undefined,
      project_id: row.project_id as string | null,
      project_name: row.project_name as string | undefined,
      uploaded_by: row.uploaded_by as string | null,
      uploader_name: row.uploader_name as string | undefined,
      is_public: Boolean(row.is_public),
      created_at: row.doc_created_at as string,
      updated_at: row.doc_updated_at as string,
    },
  }));
}

export async function canClientAccessDocument(documentId: string, clientUserId: string): Promise<boolean> {
  const result = await turso.execute({
    sql: `SELECT 1 FROM client_documents
          WHERE document_id = ? AND client_user_id = ?
            AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    args: [documentId, clientUserId],
  });
  return result.rows.length > 0;
}

// ============ ACCESS TRACKING ============

export async function markDocumentViewed(documentId: string, clientUserId: string): Promise<void> {
  await turso.execute({
    sql: `UPDATE client_documents SET viewed_at = datetime('now')
          WHERE document_id = ? AND client_user_id = ? AND viewed_at IS NULL`,
    args: [documentId, clientUserId],
  });
}

export async function markDocumentDownloaded(documentId: string, clientUserId: string): Promise<void> {
  await turso.execute({
    sql: `UPDATE client_documents SET downloaded_at = datetime('now')
          WHERE document_id = ? AND client_user_id = ?`,
    args: [documentId, clientUserId],
  });
}

// ============ HELPERS ============

export function getFileTypeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const typeMap: Record<string, string> = {
    pdf: "pdf",
    doc: "doc",
    docx: "doc",
    xls: "xls",
    xlsx: "xls",
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    webp: "image",
    txt: "text",
    csv: "text",
  };
  return typeMap[ext] || "other";
}

export async function getClients(): Promise<{ id: string; first_name: string; last_name: string; email: string }[]> {
  const result = await turso.execute(`
    SELECT id, first_name, last_name, email FROM users WHERE role = 'client' ORDER BY first_name, last_name
  `);
  return result.rows.map((row) => ({
    id: row.id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    email: row.email as string,
  }));
}
