import { cookies } from "next/headers";
import { getSession, getUserById } from "@/lib/auth";
import {
  DEFAULT_TL_CORP_ORGANIZATION,
  getTlCorpOrganization,
  updateTlCorpOrganization,
  type TlCorpOrganizationInput,
} from "@/lib/tl-corp-organization";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeInput(body: Record<string, unknown>): TlCorpOrganizationInput | null {
  const str = (key: keyof TlCorpOrganizationInput) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : "";
  };

  const input: TlCorpOrganizationInput = {
    registration_label: str("registration_label") || DEFAULT_TL_CORP_ORGANIZATION.registration_label,
    business_name: str("business_name"),
    phone: str("phone"),
    email: str("email"),
    address_line1: str("address_line1"),
    city_state: str("city_state"),
    postal_code: str("postal_code"),
    website: str("website"),
    invoice_footer: str("invoice_footer"),
  };

  if (!input.business_name) return null;
  if (!input.phone) return null;
  if (!input.email || !isValidEmail(input.email)) return null;
  if (!input.address_line1) return null;
  if (!input.city_state) return null;
  if (!input.postal_code) return null;

  return input;
}

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const session = await getSession(sessionId);
  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await getUserById(session.user_id);
  if (!user || user.role !== "admin") {
    return { error: Response.json({ error: "Only admins can manage organization settings" }, { status: 403 }) };
  }

  return { user };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const organization = await getTlCorpOrganization();
    return Response.json({ organization });
  } catch (error) {
    console.error("Error fetching TL Corp organization:", error);
    return Response.json({ error: "Failed to load organization settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const input = normalizeInput(body as Record<string, unknown>);

    if (!input) {
      return Response.json(
        { error: "Business name, phone, email, and address fields are required." },
        { status: 400 }
      );
    }

    const organization = await updateTlCorpOrganization(input);
    return Response.json({ organization });
  } catch (error) {
    console.error("Error updating TL Corp organization:", error);
    return Response.json({ error: "Failed to save organization settings" }, { status: 500 });
  }
}
