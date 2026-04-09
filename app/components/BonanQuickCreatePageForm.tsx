"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUsCentralDate } from "@/lib/us-central-time";

type BonanQuickCreateMode = "work-order" | "incident-report";
type UserRole = "admin" | "employee" | "client";
type WorkOrderPriority = "emergency" | "high" | "normal" | "low";
type WorkOrderServiceType =
  | "maintenance"
  | "repair"
  | "replace"
  | "inspection"
  | "preventive"
  | "cleaning"
  | "other";
type WorkOrderStatus = "pending" | "in_progress";
type IncidentStatus = "open" | "in_progress" | "closed";

interface BonanQuickCreatePageFormProps {
  mode: BonanQuickCreateMode;
}

const WORK_ORDER_PRIORITIES: Array<{ value: WorkOrderPriority; label: string }> = [
  { value: "emergency", label: "Board Approval Level" },
  { value: "high", label: "Priority - Immediate" },
  { value: "normal", label: "Priority - Moderate" },
  { value: "low", label: "Priority - Low" },
];

const SERVICE_TYPES: Array<{ value: WorkOrderServiceType; label: string }> = [
  { value: "maintenance", label: "Maintenance" },
  { value: "repair", label: "Repair" },
  { value: "replace", label: "Replace" },
  { value: "inspection", label: "Inspection" },
  { value: "preventive", label: "Preventive" },
  { value: "cleaning", label: "Cleaning" },
  { value: "other", label: "Other" },
];

const WORK_ORDER_STATUSES: Array<{ value: WorkOrderStatus; label: string }> = [
  { value: "pending", label: "Approval Needed" },
  { value: "in_progress", label: "In Progress" },
];

const INCIDENT_STATUSES: Array<{ value: Extract<IncidentStatus, "open" | "in_progress">; label: string }> = [
  { value: "open", label: "Approval Needed" },
  { value: "in_progress", label: "In Progress" },
];

function createInitialWorkOrderForm() {
  return {
    report_date: getUsCentralDate(),
    area: "",
    unit: "",
    access_needed: "",
    preferred_entry_time: "",
    priority: "normal" as WorkOrderPriority,
    service_type: "maintenance" as WorkOrderServiceType,
    work_completed: "pending" as WorkOrderStatus,
    description: "",
  };
}

function createInitialIncidentForm() {
  return {
    report_date: getUsCentralDate(),
    section_name: "",
    incident_time: "",
    system_area: "",
    status: "open" as IncidentStatus,
    description: "",
    actions_taken: "",
    work_order_or_vendor: "",
  };
}

function getSafeReturnHref(mode: BonanQuickCreateMode, requestedHref: string | null) {
  const fallback =
    mode === "work-order"
      ? "/dashboard/management?tab=work-orders&site=bonan_towers"
      : "/dashboard/management?tab=incident-reports&site=bonan_towers";

  if (!requestedHref) return fallback;
  const allowedPrefixes = [
    "/dashboard/management",
    "/dashboard/work-orders",
    "/dashboard/incident-reports",
    "/dashboard/bonan",
    "/dashboard/employee",
  ];
  if (!allowedPrefixes.some((prefix) => requestedHref.startsWith(prefix))) return fallback;
  return requestedHref;
}

export default function BonanQuickCreatePageForm({ mode }: BonanQuickCreatePageFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [workOrderForm, setWorkOrderForm] = useState(createInitialWorkOrderForm);
  const [incidentForm, setIncidentForm] = useState(createInitialIncidentForm);

  const isWorkOrder = mode === "work-order";
  const isEmployee = userRole === "employee";
  const isAdmin = userRole === "admin";
  const title = isWorkOrder ? "New Bonan Work Order" : "New Bonan Incident Report";
  const description = isWorkOrder
    ? "Create a Bonan Towers work order for items that were not captured during a walkthrough, including weekend or after-hours follow-up."
    : "Create a Bonan Towers incident report for events that were not captured during a walkthrough, including weekend or after-hours follow-up.";
  const submitLabel = submitting
    ? "Saving..."
    : isWorkOrder
      ? "Create Work Order"
      : "Create Incident Report";
  const returnHref = useMemo(
    () => getSafeReturnHref(mode, searchParams.get("returnTo")),
    [mode, searchParams]
  );

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json().catch(() => ({}));
        if (data.user?.role === "admin" || data.user?.role === "employee" || data.user?.role === "client") {
          setUserRole(data.user.role as UserRole);
          return;
        }
      } catch (sessionError) {
        console.error("Failed to load quick create session:", sessionError);
      }

      setUserRole("admin");
    }

    void loadSession();
  }, []);

  useEffect(() => {
    if (!isEmployee) return;

    setWorkOrderForm((current) =>
      current.work_completed === "in_progress" ? current : { ...current, work_completed: "in_progress" }
    );
    setIncidentForm((current) =>
      current.status === "in_progress" ? current : { ...current, status: "in_progress" }
    );
  }, [isEmployee]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const endpoint = isWorkOrder
      ? "/api/management/bonan/work-orders"
      : "/api/management/bonan/incident-reports";
    const body = isWorkOrder ? workOrderForm : incidentForm;
    const descriptionValue = body.description.trim();

    if (!descriptionValue) {
      setError("Description is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, description: descriptionValue }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Failed to create Bonan event.");
        return;
      }

      const createdId = isWorkOrder
        ? (data.workOrder?.id as string | undefined)
        : (data.incidentReport?.id as string | undefined);

      if (!createdId) {
        setError("The record was created, but no destination could be opened.");
        return;
      }

      router.push(
        isWorkOrder
          ? `/dashboard/management/work-orders/${createdId}`
          : `/dashboard/management/incident-reports/${createdId}`
      );
    } catch (createError) {
      console.error("Failed to create Bonan event:", createError);
      setError("Failed to create Bonan event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-5 flex items-start gap-3 sm:mb-6">
          <Link
            href={returnHref}
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--border)/30 bg-white text-(--text) transition hover:bg-(--bg)"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Bonan Towers
            </p>
            <h1 className="mt-1 text-2xl font-bold text-(--text) sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-(--text)/65">{description}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Location is fixed to Bonan Towers. The record is linked to the matching Bonan reporting
          period for the selected date so it appears in Bonan rollups and monthly reporting.
          {isEmployee && (
            <span className="mt-2 block font-medium">
              Employee-created records start In Progress automatically so they are visible to the team right away.
            </span>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="pb-24 sm:pb-0">
          <div className="mt-5 rounded-3xl border border-(--border)/15 bg-white p-4 shadow-sm sm:mt-6 sm:p-6">
            <div className="space-y-5">
              {isWorkOrder ? (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Event date
                      </span>
                      <input
                        type="date"
                        value={workOrderForm.report_date}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({
                            ...current,
                            report_date: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Area</span>
                      <input
                        type="text"
                        value={workOrderForm.area}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({ ...current, area: event.target.value }))
                        }
                        placeholder="Lobby, garage, roof, etc."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Unit</span>
                      <input
                        type="text"
                        value={workOrderForm.unit}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({ ...current, unit: event.target.value }))
                        }
                        placeholder="Optional unit or room"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Access needed
                      </span>
                      <input
                        type="text"
                        value={workOrderForm.access_needed}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({
                            ...current,
                            access_needed: event.target.value,
                          }))
                        }
                        placeholder="Key, code, escort, etc."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Preferred entry time
                      </span>
                      <input
                        type="text"
                        value={workOrderForm.preferred_entry_time}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({
                            ...current,
                            preferred_entry_time: event.target.value,
                          }))
                        }
                        placeholder="Optional time window"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Priority
                      </span>
                      <select
                        value={workOrderForm.priority}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({
                            ...current,
                            priority: event.target.value as WorkOrderPriority,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      >
                        {WORK_ORDER_PRIORITIES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Service type
                      </span>
                      <select
                        value={workOrderForm.service_type}
                        onChange={(event) =>
                          setWorkOrderForm((current) => ({
                            ...current,
                            service_type: event.target.value as WorkOrderServiceType,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      >
                        {SERVICE_TYPES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {isAdmin && (
                      <label className="block md:col-span-2">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">
                          Starting status
                        </span>
                        <select
                          value={workOrderForm.work_completed}
                          onChange={(event) =>
                            setWorkOrderForm((current) => ({
                              ...current,
                              work_completed: event.target.value as WorkOrderStatus,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          disabled={submitting}
                        >
                          {WORK_ORDER_STATUSES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Description of issue or request
                    </span>
                    <textarea
                      rows={7}
                      value={workOrderForm.description}
                      onChange={(event) =>
                        setWorkOrderForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe the isolated Bonan work order in detail..."
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      disabled={submitting}
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Event date
                      </span>
                      <input
                        type="date"
                        value={incidentForm.report_date}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            report_date: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Incident time
                      </span>
                      <input
                        type="time"
                        value={incidentForm.incident_time}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            incident_time: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Incident title or area
                      </span>
                      <input
                        type="text"
                        value={incidentForm.section_name}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            section_name: event.target.value,
                          }))
                        }
                        placeholder="General incident, elevator lobby, alarm panel, etc."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        System area
                      </span>
                      <input
                        type="text"
                        value={incidentForm.system_area}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            system_area: event.target.value,
                          }))
                        }
                        placeholder="Fire panel, elevator, electrical room, etc."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    {isAdmin && (
                      <label className="block md:col-span-2">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Starting status</span>
                        <select
                          value={incidentForm.status}
                          onChange={(event) =>
                            setIncidentForm((current) => ({
                              ...current,
                              status: event.target.value as IncidentStatus,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          disabled={submitting}
                        >
                          {INCIDENT_STATUSES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">
                      Description
                    </span>
                    <textarea
                      rows={6}
                      value={incidentForm.description}
                      onChange={(event) =>
                        setIncidentForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Describe the incident, alarm, or isolated event..."
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      disabled={submitting}
                      required
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Actions taken
                      </span>
                      <textarea
                        rows={5}
                        value={incidentForm.actions_taken}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            actions_taken: event.target.value,
                          }))
                        }
                        placeholder="Immediate response, escalation, mitigation, etc."
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">
                        Work order or vendor
                      </span>
                      <textarea
                        rows={5}
                        value={incidentForm.work_order_or_vendor}
                        onChange={(event) =>
                          setIncidentForm((current) => ({
                            ...current,
                            work_order_or_vendor: event.target.value,
                          }))
                        }
                        placeholder="Optional related vendor or work order note"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        disabled={submitting}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-(--border)/15 bg-white/95 px-3 py-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
            <div className="mx-auto max-w-3xl pb-[calc(env(safe-area-inset-bottom)+0.25rem)] sm:max-w-none sm:pb-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href={returnHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
