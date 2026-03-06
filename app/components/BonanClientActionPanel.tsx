"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SignatureCapture from "./SignatureCapture";

type BonanEntityType = "bonan_report" | "work_order" | "incident_report";

interface FieldOption {
  value: string;
  label: string;
}

interface Approval {
  id: string;
  approved_revision: number;
  approved_by_user_id: string;
  signer_name: string;
  approval_date: string;
  approved_at: string;
}

interface ChangeRequest {
  id: string;
  requested_area: string;
  requested_fields: string[];
  approved_fields: string[];
  status: "pending" | "grant_approved" | "changes_submitted" | "applied" | "rejected" | "expired";
  admin_notes: string | null;
  created_at: string;
}

export default function BonanClientActionPanel({
  entityType,
  entityId,
  defaultArea,
  fieldOptions,
  currentFieldValues = {},
}: {
  entityType: BonanEntityType;
  entityId: string;
  defaultArea: string;
  fieldOptions: FieldOption[];
  currentFieldValues?: Record<string, string>;
}) {
  const [currentRevision, setCurrentRevision] = useState(1);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showApprovalCapture, setShowApprovalCapture] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showApprovedEdits, setShowApprovedEdits] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [approvalForm, setApprovalForm] = useState({
    signer_name: "",
    approval_date: new Date().toISOString().slice(0, 10),
  });
  const [requestForm, setRequestForm] = useState({
    requested_area: defaultArea,
    requested_fields: [] as string[],
    message: "",
  });
  const [approvedEditValues, setApprovedEditValues] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalRes, requestRes] = await Promise.all([
        fetch(`/api/bonan/approvals?entity_type=${entityType}&entity_id=${entityId}`),
        fetch(`/api/bonan/change-requests?entity_type=${entityType}&entity_id=${entityId}`),
      ]);
      const approvalData = await approvalRes.json().catch(() => ({}));
      const requestData = await requestRes.json().catch(() => ({}));

      if (approvalRes.ok) {
        setApprovals(approvalData.approvals || []);
        setCurrentRevision(approvalData.currentRevision || 1);
      }
      if (requestRes.ok) {
        setChangeRequests(requestData.changeRequests || []);
      }
    } catch (fetchError) {
      console.error("Failed to load Bonan client action data:", fetchError);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentApproval = useMemo(
    () => approvals.find((approval) => approval.approved_revision === currentRevision),
    [approvals, currentRevision]
  );
  const activeGrantedRequest = useMemo(
    () => changeRequests.find((request) => request.status === "grant_approved"),
    [changeRequests]
  );

  useEffect(() => {
    if (!activeGrantedRequest) return;
    setApprovedEditValues((current) => {
      const next = { ...current };
      for (const fieldPath of activeGrantedRequest.approved_fields) {
        if (!(fieldPath in next)) {
          next[fieldPath] = currentFieldValues[fieldPath] || "";
        }
      }
      return next;
    });
  }, [activeGrantedRequest, currentFieldValues]);

  async function handleSaveApproval(signatureData: string) {
    setSubmitting(true);
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/bonan/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          signer_name: approvalForm.signer_name,
          approval_date: approvalForm.approval_date,
          signature_data: signatureData,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to record approval.");
        return;
      }
      setFeedback("Approval recorded.");
      setShowApprovalCapture(false);
      await loadData();
    } catch (saveError) {
      console.error("Failed to save Bonan approval:", saveError);
      setError("Failed to record approval.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestCorrection() {
    setSubmitting(true);
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/bonan/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          ...requestForm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to submit correction request.");
        return;
      }
      setFeedback("Correction request sent.");
      setShowRequestForm(false);
      setRequestForm({ requested_area: defaultArea, requested_fields: [], message: "" });
      await loadData();
    } catch (requestError) {
      console.error("Failed to create Bonan correction request:", requestError);
      setError("Failed to submit correction request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitApprovedEdits() {
    if (!activeGrantedRequest) return;

    setSubmitting(true);
    setError("");
    setFeedback("");
    try {
      const edits = activeGrantedRequest.approved_fields.map((fieldPath) => ({
        field_path: fieldPath,
        old_value: currentFieldValues[fieldPath] || "",
        proposed_value: approvedEditValues[fieldPath] || "",
      }));

      const res = await fetch(`/api/bonan/change-requests/${activeGrantedRequest.id}/edits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to submit approved corrections.");
        return;
      }
      setFeedback("Approved corrections submitted for admin review.");
      setShowApprovedEdits(false);
      await loadData();
    } catch (submitError) {
      console.error("Failed to submit Bonan approved edits:", submitError);
      setError("Failed to submit approved corrections.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,250,0.96))] p-4 md:p-6 space-y-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Final Step
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Approval and correction requests</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            If everything is correct, sign and approve this version. If you spot an issue,
            request a correction for one specific area so the admin can review it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowApprovalCapture(true)}
            className="rounded-full bg-[#0f4c81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c416d] transition"
          >
            {currentApproval ? "Re-Approve & Sign" : "Approve & Sign"}
          </button>
          <button
            type="button"
            onClick={() => setShowRequestForm(true)}
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition"
          >
            Request Correction
          </button>
          {activeGrantedRequest && (
            <button
              type="button"
              onClick={() => setShowApprovedEdits(true)}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition"
            >
              Submit Approved Correction
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading approval status...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Approval</p>
            {currentApproval ? (
              <div className="mt-3 text-sm text-slate-800">
                <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Approved
                </div>
                <p className="mt-3 font-medium">{currentApproval.signer_name}</p>
                <p className="text-slate-600">Approved on {currentApproval.approval_date}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No approval on the current revision yet.</p>
            )}
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Corrections</p>
            {changeRequests.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No correction requests submitted for this record.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {changeRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
                    <p className="font-medium capitalize">{request.status.replace(/_/g, " ")}</p>
                    <p className="text-slate-600">{request.requested_area}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {feedback && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showApprovalCapture && (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={approvalForm.signer_name}
              onChange={(event) => setApprovalForm((current) => ({ ...current, signer_name: event.target.value }))}
              placeholder="Your name"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
            <input
              type="date"
              value={approvalForm.approval_date}
              onChange={(event) => setApprovalForm((current) => ({ ...current, approval_date: event.target.value }))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
          </div>
          <SignatureCapture
            signerType="building_rep"
            signerName={approvalForm.signer_name}
            signerTitle="Bonan Client"
            onSave={(signatureData) => void handleSaveApproval(signatureData)}
            onCancel={() => setShowApprovalCapture(false)}
          />
        </div>
      )}

      {showRequestForm && (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-4">
          <input
            type="text"
            value={requestForm.requested_area}
            onChange={(event) => setRequestForm((current) => ({ ...current, requested_area: event.target.value }))}
            placeholder="Area"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {fieldOptions.map((field) => (
              <label key={field.value} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={requestForm.requested_fields.includes(field.value)}
                  onChange={() =>
                    setRequestForm((current) => ({
                      ...current,
                      requested_fields: current.requested_fields.includes(field.value)
                        ? current.requested_fields.filter((entry) => entry !== field.value)
                        : [...current.requested_fields, field.value],
                    }))
                  }
                />
                {field.label}
              </label>
            ))}
          </div>
          <textarea
            value={requestForm.message}
            onChange={(event) => setRequestForm((current) => ({ ...current, message: event.target.value }))}
            rows={3}
            placeholder="Explain the correction needed"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowRequestForm(false)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || requestForm.requested_fields.length === 0 || !requestForm.requested_area.trim()}
              onClick={() => void handleRequestCorrection()}
              className="rounded-full bg-[#0f4c81] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Send Request
            </button>
          </div>
        </div>
      )}

      {showApprovedEdits && activeGrantedRequest && (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 md:p-5 space-y-4">
          <p className="text-sm text-emerald-800">
            Only the approved fields below can be updated for {activeGrantedRequest.requested_area}.
          </p>
          {activeGrantedRequest.approved_fields.map((fieldPath) => (
            <div key={fieldPath} className="space-y-1">
              <label className="text-sm font-medium text-(--text)">{fieldPath}</label>
              <textarea
                rows={2}
                value={approvedEditValues[fieldPath] || ""}
                onChange={(event) =>
                  setApprovedEditValues((current) => ({
                    ...current,
                    [fieldPath]: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowApprovedEdits(false)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleSubmitApprovedEdits()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Submit Approved Correction
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
