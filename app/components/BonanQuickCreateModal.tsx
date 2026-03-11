"use client";

import { useEffect, useState } from "react";
import { getUsCentralDate } from "@/lib/us-central-time";

type BonanQuickCreateMode = "work-order" | "incident-report";
type WorkOrderPriority = "emergency" | "high" | "normal" | "low";
type WorkOrderServiceType =
  | "maintenance"
  | "repair"
  | "replace"
  | "inspection"
  | "preventive"
  | "cleaning"
  | "other";
type IncidentStatus = "open" | "in_progress" | "closed";

interface BonanQuickCreateResult {
  id: string;
  anchorReport: {
    id: string;
    report_type: "daily" | "weekly" | "monthly";
    report_date: string;
  };
}

interface BonanQuickCreateModalProps {
  open: boolean;
  mode: BonanQuickCreateMode;
  onClose: () => void;
  onCreated: (result: BonanQuickCreateResult) => void;
}

const WORK_ORDER_PRIORITIES: Array<{ value: WorkOrderPriority; label: string }> = [
  { value: "emergency", label: "Emergency" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
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

const INCIDENT_STATUSES: Array<{ value: IncidentStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "closed", label: "Closed" },
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

export default function BonanQuickCreateModal({
  open,
  mode,
  onClose,
  onCreated,
}: BonanQuickCreateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [workOrderForm, setWorkOrderForm] = useState(createInitialWorkOrderForm);
  const [incidentForm, setIncidentForm] = useState(createInitialIncidentForm);

  useEffect(() => {
    if (!open) return;

    setSubmitting(false);
    setError("");

    if (mode === "work-order") {
      setWorkOrderForm(createInitialWorkOrderForm());
      return;
    }

    setIncidentForm(createInitialIncidentForm());
  }, [mode, open]);

  if (!open) return null;

  const isWorkOrder = mode === "work-order";
  const title = isWorkOrder ? "Create Bonan Work Order" : "Create Bonan Incident Report";
  const submitLabel = submitting
    ? "Saving..."
    : isWorkOrder
      ? "Create Work Order"
      : "Create Incident Report";

  async function handleSubmit() {
    const endpoint = isWorkOrder
      ? "/api/management/bonan/work-orders"
      : "/api/management/bonan/incident-reports";
    const body = isWorkOrder ? workOrderForm : incidentForm;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to create Bonan event.");
        return;
      }

      onCreated(
        isWorkOrder
          ? {
              id: data.workOrder.id as string,
              anchorReport: data.anchorReport as BonanQuickCreateResult["anchorReport"],
            }
          : {
              id: data.incidentReport.id as string,
              anchorReport: data.anchorReport as BonanQuickCreateResult["anchorReport"],
            }
      );
    } catch (createError) {
      console.error("Failed to create Bonan isolated event:", createError);
      setError("Failed to create Bonan event.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Location is fixed to Bonan Towers. The event is linked to the matching Bonan
              reporting period for the selected date so it appears in Bonan rollups.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose();
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            disabled={submitting}
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Use this for isolated Bonan events that did not come from a walkthrough section. If a
          daily report does not already exist, the system will reuse a matching Bonan reporting
          period when possible and only create a daily report as a fallback.
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {isWorkOrder ? (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Event date</span>
                <input
                  type="date"
                  value={workOrderForm.report_date}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({ ...current, report_date: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Area</span>
                <input
                  type="text"
                  value={workOrderForm.area}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({ ...current, area: event.target.value }))
                  }
                  placeholder="Lobby, garage, roof, etc."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Unit</span>
                <input
                  type="text"
                  value={workOrderForm.unit}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({ ...current, unit: event.target.value }))
                  }
                  placeholder="Optional unit or room"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Priority</span>
                <select
                  value={workOrderForm.priority}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      priority: event.target.value as WorkOrderPriority,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                <span className="mb-1 block text-sm font-medium text-slate-700">Service type</span>
                <select
                  value={workOrderForm.service_type}
                  onChange={(event) =>
                    setWorkOrderForm((current) => ({
                      ...current,
                      service_type: event.target.value as WorkOrderServiceType,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                >
                  {SERVICE_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Description of issue or request
              </span>
              <textarea
                rows={6}
                value={workOrderForm.description}
                onChange={(event) =>
                  setWorkOrderForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe the isolated Bonan work order in detail..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                disabled={submitting}
              />
            </label>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Event date</span>
                <input
                  type="date"
                  value={incidentForm.report_date}
                  onChange={(event) =>
                    setIncidentForm((current) => ({ ...current, report_date: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
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
                  placeholder="General Incident, elevator lobby, alarm panel, etc."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">System area</span>
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={incidentForm.status}
                  onChange={(event) =>
                    setIncidentForm((current) => ({
                      ...current,
                      status: event.target.value as IncidentStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                >
                  {INCIDENT_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
              <textarea
                rows={5}
                value={incidentForm.description}
                onChange={(event) =>
                  setIncidentForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Describe the incident, alarm, or isolated event..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                disabled={submitting}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Actions taken
                </span>
                <textarea
                  rows={4}
                  value={incidentForm.actions_taken}
                  onChange={(event) =>
                    setIncidentForm((current) => ({
                      ...current,
                      actions_taken: event.target.value,
                    }))
                  }
                  placeholder="Immediate response, escalation, mitigation, etc."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Work order or vendor
                </span>
                <textarea
                  rows={4}
                  value={incidentForm.work_order_or_vendor}
                  onChange={(event) =>
                    setIncidentForm((current) => ({
                      ...current,
                      work_order_or_vendor: event.target.value,
                    }))
                  }
                  placeholder="Optional related vendor or work order note"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  disabled={submitting}
                />
              </label>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              if (!submitting) onClose();
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
