import { ensureBonanClientSchema } from "./bonan-client";
import { turso } from "./turso";

export type MaterialPurchaseEntityType = "work_order" | "incident_report";

export interface MaterialPurchase {
  id: string;
  entity_type: MaterialPurchaseEntityType;
  entity_id: string;
  store_name: string;
  description: string | null;
  total_cost: number;
  receipt_filename: string;
  receipt_s3_key: string | null;
  receipt_s3_url: string | null;
  purchased_by: string | null;
  purchaser_name?: string;
  created_at: string;
  updated_at: string;
}

function mapRowToMaterialPurchase(row: Record<string, unknown>): MaterialPurchase {
  return {
    id: row.id as string,
    entity_type: row.entity_type as MaterialPurchaseEntityType,
    entity_id: row.entity_id as string,
    store_name: row.store_name as string,
    description: row.description as string | null,
    total_cost: Number(row.total_cost || 0),
    receipt_filename: row.receipt_filename as string,
    receipt_s3_key: row.receipt_s3_key as string | null,
    receipt_s3_url: row.receipt_s3_url as string | null,
    purchased_by: row.purchased_by as string | null,
    purchaser_name: row.purchaser_name as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getMaterialPurchases(
  entityType: MaterialPurchaseEntityType,
  entityId: string
): Promise<MaterialPurchase[]> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT mp.*,
                 u.first_name || ' ' || u.last_name AS purchaser_name
          FROM material_purchases mp
          LEFT JOIN users u ON u.id = mp.purchased_by
          WHERE mp.entity_type = ?
            AND mp.entity_id = ?
          ORDER BY mp.created_at DESC`,
    args: [entityType, entityId],
  });

  return result.rows.map(mapRowToMaterialPurchase);
}

export async function addMaterialPurchase(data: {
  entity_type: MaterialPurchaseEntityType;
  entity_id: string;
  store_name: string;
  description?: string | null;
  total_cost: number;
  receipt_filename: string;
  receipt_s3_key?: string | null;
  receipt_s3_url?: string | null;
  purchased_by?: string | null;
}): Promise<MaterialPurchase> {
  await ensureBonanClientSchema();
  const id = crypto.randomUUID().replace(/-/g, "");

  await turso.execute({
    sql: `INSERT INTO material_purchases (
            id,
            entity_type,
            entity_id,
            store_name,
            description,
            total_cost,
            receipt_filename,
            receipt_s3_key,
            receipt_s3_url,
            purchased_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      data.entity_type,
      data.entity_id,
      data.store_name.trim(),
      data.description?.trim() || null,
      data.total_cost,
      data.receipt_filename,
      data.receipt_s3_key || null,
      data.receipt_s3_url || null,
      data.purchased_by || null,
    ],
  });

  const created = await getMaterialPurchaseById(id);
  if (!created) {
    throw new Error("Failed to load created material purchase");
  }

  return created;
}

export async function getMaterialPurchaseById(id: string): Promise<MaterialPurchase | null> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT mp.*,
                 u.first_name || ' ' || u.last_name AS purchaser_name
          FROM material_purchases mp
          LEFT JOIN users u ON u.id = mp.purchased_by
          WHERE mp.id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;
  return mapRowToMaterialPurchase(result.rows[0]);
}

export async function deleteMaterialPurchase(id: string): Promise<MaterialPurchase | null> {
  await ensureBonanClientSchema();
  const existing = await getMaterialPurchaseById(id);
  if (!existing) return null;

  await turso.execute({
    sql: `DELETE FROM material_purchases WHERE id = ?`,
    args: [id],
  });

  return existing;
}

export async function getMaterialPurchaseTotal(
  entityType: MaterialPurchaseEntityType,
  entityId: string
): Promise<number> {
  await ensureBonanClientSchema();
  const result = await turso.execute({
    sql: `SELECT COALESCE(SUM(total_cost), 0) AS total
          FROM material_purchases
          WHERE entity_type = ?
            AND entity_id = ?`,
    args: [entityType, entityId],
  });

  return Number(result.rows[0]?.total || 0);
}
