"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { PREDEFINED_CATEGORIES } from "@/lib/estimate-categories";

interface EstimateItem {
  category: string;
  customName: string;
  description: string;
  priceRate: string;
  quantity: string;
}

interface EstimateCustomEntry {
  id: string;
  name: string;
  description: string | null;
  default_price_rate: number;
  default_quantity: number;
}

interface SessionUser {
  id: string;
  role: "admin" | "employee" | "client";
}

const initialProject = {
  name: "",
  description: "",
  status: "planning",
  address: "",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function NewProjectPage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customEntries, setCustomEntries] = useState<EstimateCustomEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [savingCustomEntryIndex, setSavingCustomEntryIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [newProject, setNewProject] = useState(initialProject);
  const [estimateItems, setEstimateItems] = useState<EstimateItem[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [markupType, setMarkupType] = useState<"percentage" | "fixed">("percentage");
  const [markupValue, setMarkupValue] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [onlineServicingFee, setOnlineServicingFee] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sessionRes, entriesRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/estimate/custom-entries"),
        ]);
        const sessionData = await sessionRes.json().catch(() => ({}));
        const nextUser = sessionData.user as SessionUser | undefined;

        if (!nextUser) {
          router.push("/login");
          return;
        }

        if (nextUser.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        setUser(nextUser);

        if (entriesRes.ok) {
          const entriesData = await entriesRes.json().catch(() => ({ entries: [] }));
          setCustomEntries(entriesData.entries || []);
        }
      } catch (loadError) {
        console.error("Failed to prepare project form:", loadError);
        setError("Unable to load the project form right now.");
      } finally {
        setCheckingAccess(false);
        setLoadingEntries(false);
      }
    }

    load();
  }, [router]);

  function toggleCategory(cat: string) {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories((prev) => prev.filter((c) => c !== cat));
      setEstimateItems((prev) => prev.filter((item) => item.category !== cat));
      return;
    }

    setSelectedCategories((prev) => [...prev, cat]);
    setEstimateItems((prev) => [
      ...prev,
      { category: cat, customName: "", description: "", priceRate: "", quantity: "1" },
    ]);
  }

  function addCustomLineItem(template?: EstimateCustomEntry) {
    setEstimateItems((prev) => [
      ...prev,
      {
        category: "custom",
        customName: template?.name || "",
        description: template?.description || "",
        priceRate:
          template?.default_price_rate !== undefined
            ? String(template.default_price_rate)
            : "",
        quantity:
          template?.default_quantity !== undefined
            ? String(template.default_quantity)
            : "1",
      },
    ]);
  }

  function removeEstimateItem(index: number) {
    setEstimateItems((prev) => {
      const item = prev[index];
      const next = prev.filter((_, idx) => idx !== index);

      if (item && item.category !== "custom") {
        setSelectedCategories((current) =>
          current.filter((category) => category !== item.category)
        );
      }

      return next;
    });
  }

  async function handleSaveCustomEntry(index: number) {
    const item = estimateItems[index];
    if (!item || item.category !== "custom") return;

    const trimmedName = item.customName.trim();
    if (!trimmedName) {
      setError("Custom entry name is required before saving.");
      return;
    }

    setSavingCustomEntryIndex(index);
    setError("");
    try {
      const res = await fetch("/api/estimate/custom-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: item.description.trim(),
          default_price_rate: parseFloat(item.priceRate) || 0,
          default_quantity: parseFloat(item.quantity) || 1,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to save custom entry.");
        return;
      }

      setCustomEntries((prev) => {
        const withoutCurrent = prev.filter((entry) => entry.id !== data.entry.id);
        return [...withoutCurrent, data.entry].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
    } catch (saveError) {
      console.error("Failed to save custom entry:", saveError);
      setError("Failed to save custom entry.");
    } finally {
      setSavingCustomEntryIndex(null);
    }
  }

  function updateEstimateItem(index: number, field: keyof EstimateItem, value: string) {
    setEstimateItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function getItemTotal(item: EstimateItem): number {
    const rate = parseFloat(item.priceRate) || 0;
    const qty = parseFloat(item.quantity) || 0;
    return rate * qty;
  }

  function getEstimateSubtotal(): number {
    return estimateItems.reduce((sum, item) => sum + getItemTotal(item), 0);
  }

  function getEstimateBreakdown() {
    const subtotal = getEstimateSubtotal();
    const markup =
      markupType === "percentage"
        ? subtotal * ((parseFloat(markupValue) || 0) / 100)
        : parseFloat(markupValue) || 0;
    const afterMarkup = subtotal + markup;
    const tax = afterMarkup * ((parseFloat(taxRate) || 0) / 100);
    const afterTax = afterMarkup + tax;
    const servicingFee = onlineServicingFee ? afterTax * 0.035 : 0;
    const total = afterTax + servicingFee;
    return { subtotal, markup, tax, servicingFee, total };
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!newProject.name.trim()) {
      setError("Project name is required.");
      return;
    }

    const hasUnnamedCustomItem = estimateItems.some(
      (item) => item.category === "custom" && !item.customName.trim()
    );
    if (hasUnnamedCustomItem) {
      setError("Every custom budget entry needs a name.");
      return;
    }

    setSubmitting(true);
    try {
      const breakdown = getEstimateBreakdown();
      const budgetTotal = breakdown.total > 0 ? breakdown.total : getEstimateSubtotal();
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProject,
          name: newProject.name.trim(),
          description: newProject.description.trim(),
          address: newProject.address.trim(),
          budget_amount: budgetTotal > 0 ? budgetTotal : null,
          funding_notes:
            budgetTotal > 0 ? `Estimate Total: $${budgetTotal.toLocaleString()}` : null,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));

      if (!createRes.ok) {
        setError(createData.error || "Failed to create project.");
        return;
      }

      const projectId = createData.project.id as string;

      if (estimateItems.length > 0) {
        await fetch(`/api/projects/${projectId}/estimate/settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markup_type: markupType,
            markup_value: parseFloat(markupValue) || 0,
            tax_rate: parseFloat(taxRate) || 0,
            servicing_fee: onlineServicingFee,
          }),
        });
      }

      for (const item of estimateItems) {
        const itemRes = await fetch(`/api/projects/${projectId}/estimate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: item.category,
            custom_category_name:
              item.category === "custom" ? item.customName.trim() : undefined,
            description: item.description.trim(),
            price_rate: parseFloat(item.priceRate) || 0,
            quantity: parseFloat(item.quantity) || 1,
          }),
        });

        if (!itemRes.ok) {
          throw new Error("Project was created, but one estimate line item failed to save.");
        }
      }

      router.push(`/dashboard/projects/${projectId}`);
    } catch (submitError) {
      console.error("Failed to create project:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create project."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const breakdown = getEstimateBreakdown();

  if (checkingAccess || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-(--border)" />
      </div>
    );
  }

  return (
    <form onSubmit={handleCreateProject} className="space-y-5 pb-24 md:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-(--text)/60">
            Projects
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-(--text)">
            New Project
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-(--text)/70">
            Create the project record first, then add an optional starting estimate.
          </p>
        </div>
        <Link
          href="/dashboard/projects"
          className="rounded-full border border-(--border) px-4 py-2 text-center text-sm font-medium text-(--text) hover:bg-(--bg)"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="tl-card p-4 md:p-6">
            <h2 className="text-base font-semibold text-(--text)">Project Details</h2>
            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-(--text)">
                  Project Name
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(event) =>
                    setNewProject({ ...newProject, name: event.target.value })
                  }
                  required
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-(--text)">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(event) =>
                    setNewProject({ ...newProject, description: event.target.value })
                  }
                  rows={4}
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-(--text)">
                  Address
                </label>
                <AddressAutocomplete
                  value={newProject.address}
                  onChange={(value) => setNewProject({ ...newProject, address: value })}
                  placeholder="Start typing an address..."
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-(--text)">
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(event) =>
                    setNewProject({ ...newProject, status: event.target.value })
                  }
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-4 py-3 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="tl-card p-4 md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-(--text)">
                  Starting Estimate
                </h2>
                <p className="mt-1 text-sm text-(--text)/70">
                  Add rough line items now, or leave this blank and build it later.
                </p>
              </div>
              {breakdown.total > 0 && (
                <p className="text-xl font-bold text-(--text)">
                  {formatCurrency(breakdown.total)}
                </p>
              )}
            </div>

            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-(--text)/60">
                Categories
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PREDEFINED_CATEGORIES.map((cat) => {
                  const checked = selectedCategories.includes(cat);
                  return (
                    <label
                      key={cat}
                      className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                        checked
                          ? "border-blue-400 bg-blue-50 text-blue-950"
                          : "border-(--border) bg-white text-(--text) hover:bg-(--bg)"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span>{cat}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addCustomLineItem()}
                className="rounded-xl border border-purple-300 bg-purple-50 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-100"
              >
                + Custom Budget Entry
              </button>
              {loadingEntries ? (
                <span className="px-3 py-2 text-xs text-(--text)/60">
                  Loading saved entries...
                </span>
              ) : (
                customEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => addCustomLineItem(entry)}
                    className="rounded-xl border border-(--border) bg-white px-3 py-2 text-xs text-(--text) hover:bg-(--bg)"
                    title={entry.description || entry.name}
                  >
                    + {entry.name}
                  </button>
                ))
              )}
            </div>

            {estimateItems.length > 0 && (
              <div className="mt-5 space-y-4">
                {estimateItems.map((item, idx) => (
                  <div
                    key={`${item.category}-${idx}`}
                    className="space-y-3 rounded-xl border border-(--border) bg-(--bg) p-3 md:p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {item.category === "custom" ? (
                        <input
                          type="text"
                          value={item.customName}
                          onChange={(event) =>
                            updateEstimateItem(idx, "customName", event.target.value)
                          }
                          placeholder="Custom category name"
                          className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) sm:max-w-xs"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-(--text)">
                          {item.category}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <p className="text-sm font-bold text-(--text)">
                          {formatCurrency(getItemTotal(item))}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeEstimateItem(idx)}
                          className="h-8 w-8 rounded-full border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50"
                          title="Remove line item"
                          aria-label="Remove line item"
                        >
                          X
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={item.description}
                      onChange={(event) =>
                        updateEstimateItem(idx, "description", event.target.value)
                      }
                      rows={2}
                      placeholder="Description - details about this line item..."
                      className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-(--text)">
                          Price Rate ($)
                        </label>
                        <input
                          type="number"
                          value={item.priceRate}
                          onChange={(event) =>
                            updateEstimateItem(idx, "priceRate", event.target.value)
                          }
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-(--text)">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(event) =>
                            updateEstimateItem(idx, "quantity", event.target.value)
                          }
                          placeholder="1"
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-(--border) bg-white px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring)"
                        />
                      </div>
                    </div>

                    {item.category === "custom" && (
                      <button
                        type="button"
                        onClick={() => handleSaveCustomEntry(idx)}
                        disabled={savingCustomEntryIndex === idx}
                        className="rounded-lg border border-(--border) bg-white px-3 py-2 text-xs font-medium text-(--text) hover:bg-(--bg) disabled:opacity-60"
                      >
                        {savingCustomEntryIndex === idx
                          ? "Saving..."
                          : "Save Entry for Future Projects"}
                      </button>
                    )}
                  </div>
                ))}

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl bg-(--tl-sand) p-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-(--tl-navy)/70">
                      Subtotal
                    </p>
                    <p className="mt-1 text-lg font-bold text-(--tl-navy)">
                      {formatCurrency(breakdown.subtotal)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-(--border) p-3">
                    <label className="mb-2 block text-xs font-medium text-(--tl-navy)">
                      Markup
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={markupType}
                        onChange={(event) =>
                          setMarkupType(event.target.value as "percentage" | "fixed")
                        }
                        className="rounded-lg border border-(--border) bg-white px-2 py-2 text-sm text-(--tl-navy)"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">$</option>
                      </select>
                      <input
                        type="number"
                        value={markupValue}
                        onChange={(event) => setMarkupValue(event.target.value)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        className="w-full rounded-lg border border-(--border) bg-white px-2 py-2 text-right text-sm text-(--tl-navy)"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-(--border) p-3">
                    <label className="mb-2 block text-xs font-medium text-(--tl-navy)">
                      Tax (%)
                    </label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      placeholder="0"
                      step="0.01"
                      min="0"
                      className="w-full rounded-lg border border-(--border) bg-white px-2 py-2 text-right text-sm text-(--tl-navy)"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-(--border) p-3">
                  <label className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-(--tl-navy)">
                      Online Servicing Fee (3.5%)
                    </span>
                    <input
                      type="checkbox"
                      checked={onlineServicingFee}
                      onChange={(event) => setOnlineServicingFee(event.target.checked)}
                      className="h-4 w-4 shrink-0"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="tl-card p-4 md:p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-(--text)/60">
              Summary
            </p>
            <div className="mt-4 space-y-3 text-sm text-(--text)">
              <div className="flex justify-between">
                <span>Line items</span>
                <span className="font-medium">{estimateItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(breakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Markup</span>
                <span className="font-medium">{formatCurrency(breakdown.markup)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="font-medium">{formatCurrency(breakdown.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Servicing fee</span>
                <span className="font-medium">
                  {formatCurrency(breakdown.servicingFee)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-(--border) pt-3">
                <span className="font-semibold">Estimate Total</span>
                <span className="text-xl font-bold text-(--tl-navy)">
                  {formatCurrency(breakdown.total)}
                </span>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 hidden w-full justify-center tl-btn px-5 py-3 text-sm disabled:opacity-60 md:flex"
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </aside>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-(--border) bg-white/95 p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
        <button
          type="submit"
          disabled={submitting}
          className="w-full tl-btn px-5 py-3 text-sm disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </div>
    </form>
  );
}
