export interface TlCorpOrganization {
  id: string;
  registration_label: string;
  business_name: string;
  phone: string;
  email: string;
  address_line1: string;
  city_state: string;
  postal_code: string;
  website: string;
  invoice_footer: string;
  updated_at: string;
}

export type TlCorpOrganizationInput = Omit<TlCorpOrganization, "id" | "updated_at">;

export const DEFAULT_TL_CORP_ORGANIZATION: TlCorpOrganizationInput = {
  registration_label: "Business Registered at",
  business_name: "TAYLOR LEONARD CONSTRUCTION CORP.",
  phone: "3144893229",
  email: "taylorleonardcorp@gmail.com",
  address_line1: "4717 Don Ron Drive",
  city_state: "ST. LOUIS MO",
  postal_code: "63123",
  website: "www.TLcorp.build",
  invoice_footer: "",
};

export function formatTlCorpPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (/^p:\s*/i.test(trimmed)) return trimmed;
  return `P: ${trimmed}`;
}
