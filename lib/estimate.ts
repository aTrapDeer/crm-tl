import type { EstimateLineItem } from "./projects";

export interface InstallmentScheduleItem {
  label: string;
  percent: number;
  due_description: string;
}

export interface EstimateSettingsInput {
  markup_type: "percentage" | "fixed";
  markup_value: number;
  tax_rate: number;
  servicing_fee: boolean;
  installment_schedule: InstallmentScheduleItem[];
  custom_terms: string | null;
  /** Snapshotted on send — controls client/email/public display */
  hide_line_item_prices_for_client?: boolean;
  hide_markup_for_client?: boolean;
}

export interface ClientVisibilitySettings {
  hide_line_item_prices_for_client: boolean;
  hide_markup_for_client: boolean;
}

export function resolveClientVisibility(
  snapshotSettings: Pick<
    EstimateSettingsInput,
    "hide_line_item_prices_for_client" | "hide_markup_for_client"
  >,
  project?: Partial<ClientVisibilitySettings>
): ClientVisibilitySettings {
  return {
    hide_line_item_prices_for_client:
      snapshotSettings.hide_line_item_prices_for_client ??
      project?.hide_line_item_prices_for_client ??
      false,
    hide_markup_for_client:
      snapshotSettings.hide_markup_for_client ?? project?.hide_markup_for_client ?? false,
  };
}

export interface EstimateBreakdown {
  subtotal: number;
  markup: number;
  afterMarkup: number;
  tax: number;
  afterTax: number;
  servicingFee: number;
  total: number;
}

export interface InstallmentWithAmount extends InstallmentScheduleItem {
  amount: number;
}

export const DEFAULT_INSTALLMENT_SCHEDULE: InstallmentScheduleItem[] = [
  { label: "Deposit", percent: 50, due_description: "Due on acceptance of contract" },
  { label: "Rough-in", percent: 25, due_description: "Due after rough-in completion" },
  { label: "Drywall", percent: 20, due_description: "Due after drywall is paint-ready" },
  { label: "Final", percent: 5, due_description: "Due after final completion" },
];

export const DEFAULT_ESTIMATE_SETTINGS: EstimateSettingsInput = {
  markup_type: "percentage",
  markup_value: 0,
  tax_rate: 0,
  servicing_fee: true,
  installment_schedule: DEFAULT_INSTALLMENT_SCHEDULE,
  custom_terms: null,
};

export function calculateEstimateBreakdown(
  subtotal: number,
  settings: Pick<EstimateSettingsInput, "markup_type" | "markup_value" | "tax_rate" | "servicing_fee">
): EstimateBreakdown {
  const markup =
    settings.markup_type === "percentage"
      ? subtotal * (settings.markup_value / 100)
      : settings.markup_value;
  const afterMarkup = subtotal + markup;
  const tax = afterMarkup * (settings.tax_rate / 100);
  const afterTax = afterMarkup + tax;
  const servicingFee = settings.servicing_fee ? afterTax * 0.035 : 0;
  const total = afterTax + servicingFee;

  return { subtotal, markup, afterMarkup, tax, afterTax, servicingFee, total };
}

export function calculateInstallmentAmounts(
  grandTotal: number,
  schedule: InstallmentScheduleItem[]
): InstallmentWithAmount[] {
  return schedule.map((item) => ({
    ...item,
    amount: grandTotal * (item.percent / 100),
  }));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCategoryLabel(item: Pick<EstimateLineItem, "category" | "custom_category_name">): string {
  return item.category === "custom"
    ? item.custom_category_name || "Custom"
    : item.category;
}

export function parseInstallmentSchedule(value: unknown): InstallmentScheduleItem[] {
  if (!value) return DEFAULT_INSTALLMENT_SCHEDULE;
  if (typeof value === "string") {
    try {
      return parseInstallmentSchedule(JSON.parse(value));
    } catch {
      return DEFAULT_INSTALLMENT_SCHEDULE;
    }
  }
  if (!Array.isArray(value)) return DEFAULT_INSTALLMENT_SCHEDULE;
  return value
    .filter(
      (item): item is InstallmentScheduleItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.label === "string" &&
        typeof item.percent === "number" &&
        typeof item.due_description === "string"
    )
    .map((item) => ({
      label: item.label,
      percent: item.percent,
      due_description: item.due_description,
    }));
}
