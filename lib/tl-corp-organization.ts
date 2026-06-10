import { turso } from "./turso";
export {
  DEFAULT_TL_CORP_ORGANIZATION,
  formatTlCorpPhone,
  type TlCorpOrganization,
  type TlCorpOrganizationInput,
} from "./tl-corp-organization-shared";
import {
  DEFAULT_TL_CORP_ORGANIZATION,
  type TlCorpOrganization,
  type TlCorpOrganizationInput,
} from "./tl-corp-organization-shared";

const SINGLETON_ID = "default";

function mapRow(row: Record<string, unknown>): TlCorpOrganization {
  return {
    id: row.id as string,
    registration_label: (row.registration_label as string) || DEFAULT_TL_CORP_ORGANIZATION.registration_label,
    business_name: (row.business_name as string) || DEFAULT_TL_CORP_ORGANIZATION.business_name,
    phone: (row.phone as string) || DEFAULT_TL_CORP_ORGANIZATION.phone,
    email: (row.email as string) || DEFAULT_TL_CORP_ORGANIZATION.email,
    address_line1: (row.address_line1 as string) || DEFAULT_TL_CORP_ORGANIZATION.address_line1,
    city_state: (row.city_state as string) || DEFAULT_TL_CORP_ORGANIZATION.city_state,
    postal_code: (row.postal_code as string) || DEFAULT_TL_CORP_ORGANIZATION.postal_code,
    website: (row.website as string) || DEFAULT_TL_CORP_ORGANIZATION.website,
    invoice_footer: (row.invoice_footer as string) || DEFAULT_TL_CORP_ORGANIZATION.invoice_footer,
    updated_at: row.updated_at as string,
  };
}

async function ensureInvoiceFooterColumn(): Promise<void> {
  await turso.execute("ALTER TABLE tl_corp_organization ADD COLUMN invoice_footer TEXT NOT NULL DEFAULT ''").catch(() => {});
}

async function seedDefaultOrganization(): Promise<TlCorpOrganization> {
  const defaults = DEFAULT_TL_CORP_ORGANIZATION;
  await ensureInvoiceFooterColumn();
  await turso.execute({
    sql: `INSERT INTO tl_corp_organization (
      id, registration_label, business_name, phone, email,
      address_line1, city_state, postal_code, website, invoice_footer
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      SINGLETON_ID,
      defaults.registration_label,
      defaults.business_name,
      defaults.phone,
      defaults.email,
      defaults.address_line1,
      defaults.city_state,
      defaults.postal_code,
      defaults.website,
      defaults.invoice_footer,
    ],
  });

  return {
    id: SINGLETON_ID,
    ...defaults,
    updated_at: new Date().toISOString(),
  };
}

export async function getTlCorpOrganization(): Promise<TlCorpOrganization> {
  await ensureInvoiceFooterColumn();
  const result = await turso.execute({
    sql: "SELECT * FROM tl_corp_organization WHERE id = ?",
    args: [SINGLETON_ID],
  });

  if (result.rows.length === 0) {
    return seedDefaultOrganization();
  }

  return mapRow(result.rows[0]);
}

export async function updateTlCorpOrganization(
  input: TlCorpOrganizationInput
): Promise<TlCorpOrganization> {
  await getTlCorpOrganization();

  await turso.execute({
    sql: `UPDATE tl_corp_organization SET
      registration_label = ?,
      business_name = ?,
      phone = ?,
      email = ?,
      address_line1 = ?,
      city_state = ?,
      postal_code = ?,
      website = ?,
      invoice_footer = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
    args: [
      input.registration_label.trim(),
      input.business_name.trim(),
      input.phone.trim(),
      input.email.trim(),
      input.address_line1.trim(),
      input.city_state.trim(),
      input.postal_code.trim(),
      input.website.trim(),
      input.invoice_footer.trim(),
      SINGLETON_ID,
    ],
  });

  return getTlCorpOrganization();
}
