"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUsCentralDateTime } from "@/lib/us-central-time";
import ClickSignatureModal from "./ClickSignatureModal";

type BonanEntityType = "bonan_report" | "work_order" | "incident_report";
type DecisionStatus = "approved" | "denied";

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

interface Decision {
  id: string;
  entity_revision: number;
  decision_status: DecisionStatus;
  responder_name: string;
  response_date: string;
  responded_at: string;
  note: string | null;
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

interface SessionUser {
  first_name?: string;
  last_name?: string;
}

const CHANGE_REQUEST_STATUS_LABELS: Record<ChangeRequest["status"], string> = {
  pending: "Pending review",
  grant_approved: "Correction window approved",
  changes_submitted: "Corrections submitted",
  applied: "Corrections applied",
  rejected: "Correction request denied",
  expired: "Correction window expired",
};

function formatDecisionLabel(status: DecisionStatus) {
  return status === "approved" ? "Client Approved" : "Client Denied";
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
  const isDecisionFlow = entityType === "work_order" || entityType === "incident_report";
  const [currentRevision, setCurrentRevision] = useState(1);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [showApprovalCapture, setShowApprovalCapture] = useState(false);
  const [showDecisionForm, setShowDecisionForm] = useState<DecisionStatus | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showApprovedEdits, setShowApprovedEdits] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [decisionForm, setDecisionForm] = useState({
    response_date: new Date().toISOString().slice(0, 10),
    note: "",
  });
  const [requestForm, setRequestForm] = useState({
    requested_area: defaultArea,
    requested_fields: [] as string[],
    message: "",
  });
  const [approvedEditValues, setApprovedEditValues] = useState<Record<string, string>>({});

  const signerName = useMemo(() => {
    if (!currentUser) return "Signer";
    return `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || "Signer";
  }, [currentUser]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [
        fetch(`/api/bonan/change-requests?entity_type=${entityType}&entity_id=${entityId}`),
      ];

      if (isDecisionFlow) {
        requests.unshift(fetch(`/api/bonan/client-decisions?entity_type=${entityType}&entity_id=${entityId}`));
      } else {
        requests.unshift(fetch(`/api/bonan/approvals?entity_type=${entityType}&entity_id=${entityId}`));
      }

      const [primaryRes, requestRes] = await Promise.all(requests);
      const primaryData = await primaryRes.json().catch(() => ({}));
      const requestData = await requestRes.json().catch(() => ({}));

      if (primaryRes.ok) {
        if (isDecisionFlow) {
          setDecisions(primaryData.decisions || []);
          setCurrentRevision(primaryData.currentRevision || 1);
        } else {
          setApprovals(primaryData.approvals || []);
          setCurrentRevision(primaryData.currentRevision || 1);
        }
      }
      if (requestRes.ok) {
        setChangeRequests(requestData.changeRequests || []);
      }
    } catch (fetchError) {
      console.error("Failed to load Bonan client action data:", fetchError);
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, isDecisionFlow]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json().catch(() => ({}));
        setCurrentUser(data.user || null);
      } catch (sessionError) {
        console.error("Failed to load signature account details:", sessionError);
      }
    }

    void loadSession();
  }, []);

  const currentApproval = useMemo(
    () => approvals.find((approval) => approval.approved_revision === currentRevision),
    [approvals, currentRevision]
  );
  const currentDecision = useMemo(
    () => decisions.find((decision) => decision.entity_revision === currentRevision),
    [currentRevision, decisions]
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
          signer_name: signerName,
          approval_date: new Date().toISOString().slice(0, 10),
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

  async function handleSubmitDecision() {
    if (!showDecisionForm) return;

    setSubmitting(true);
    setError("");
    setFeedback("");
    try {
      const res = await fetch("/api/bonan/client-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          decision_status: showDecisionForm,
          response_date: decisionForm.response_date,
          note: decisionForm.note,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed to mark this item as ${showDecisionForm}.`);
        return;
      }

      setFeedback(
        showDecisionForm === "approved"
          ? "Client approval recorded and admins notified."
          : "Client denial recorded and admins notified."
      );
      setShowDecisionForm(null);
      setDecisionForm({
        response_date: new Date().toISOString().slice(0, 10),
        note: "",
      });
      await loadData();
    } catch (submitError) {
      console.error("Failed to save Bonan client decision:", submitError);
      setError(`Failed to mark this item as ${showDecisionForm}.`);
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
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {isDecisionFlow ? "Client decision and correction requests" : "Approval and correction requests"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isDecisionFlow
              ? "Approve the current version, deny it, or request corrections so the admin team knows how to proceed."
              : "If everything is correct, sign and approve this version. If you spot an issue, request a correction for one specific area so the admin can review it."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDecisionFlow ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowDecisionForm("approved")}
                className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
              >
                {currentDecision?.decision_status === "approved" ? "Update Approval" : "Approve"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowDecisionForm("denied")}
                className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-60"
              >
                {currentDecision?.decision_status === "denied" ? "Update Denial" : "Deny"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowApprovalCapture(true)}
              className="rounded-full bg-[#0f4c81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c416d] transition"
            >
              {currentApproval ? "Re-Approve & Sign" : "Approve & Sign"}
            </button>
          )}
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
        <p className="text-sm text-slate-500">
          Loading {isDecisionFlow ? "client decision status" : "approval status"}...
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isDecisionFlow ? "Current Client Decision" : "Approval"}
            </p>
            {isDecisionFlow ? (
              currentDecision ? (
                <div className="mt-3 text-sm text-slate-800">
                  <div
                    className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                      currentDecision.decision_status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {formatDecisionLabel(currentDecision.decision_status)}
                  </div>
                  <p className="mt-3 font-medium">{currentDecision.responder_name}</p>
                  <p className="text-slate-600">Response date {currentDecision.response_date}</p>
                  <p className="text-slate-500">
                    Logged {formatUsCentralDateTime(currentDecision.responded_at)} CT
                  </p>
                  {currentDecision.note ? (
                    <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-slate-700">
                      {currentDecision.note}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">No client decision has been recorded on this revision yet.</p>
              )
            ) : currentApproval ? (
              <div className="mt-3 text-sm text-slate-800">
                <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Approved
                </div>
                <p className="mt-3 font-medium">{currentApproval.signer_name}</p>
                <p className="text-slate-600">Approved on {currentApproval.approval_date}</p>
                <p className="text-slate-500">
                  Logged {formatUsCentralDateTime(currentApproval.approved_at)} CT
                </p>
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
                    <p className="font-medium">{CHANGE_REQUEST_STATUS_LABELS[request.status]}</p>
                    <p className="text-slate-600">{request.requested_area}</p>
                    <p className="text-xs text-slate-500">
                      Submitted {formatUsCentralDateTime(request.created_at)} CT
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {feedback && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p>}
      {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {showApprovalCapture && !isDecisionFlow && (
        <ClickSignatureModal
          signerName={signerName}
          signerTitle="Bonan Client"
          signerLabel="Client Signer"
          submitLabel="Submit Approval"
          submitting={submitting}
          onSave={(signatureData) => void handleSaveApproval(signatureData)}
          onCancel={() => setShowApprovalCapture(false)}
        />
      )}

      {showDecisionForm && isDecisionFlow && (
        <div
          className={`rounded-[24px] border p-4 md:p-5 space-y-4 ${
            showDecisionForm === "approved"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <div>
            <p
              className={`text-sm font-semibold ${
                showDecisionForm === "approved" ? "text-emerald-800" : "text-red-800"
              }`}
            >
              {showDecisionForm === "approved"
                ? "Approve this work item for Bonan."
                : "Mark this work item as denied for Bonan."}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              This will notify admins and save the item under the current client decision category.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="date"
              value={decisionForm.response_date}
              onChange={(event) => setDecisionForm((current) => ({ ...current, response_date: event.target.value }))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              value={showDecisionForm === "approved" ? "Client approved" : "Client denied"}
              readOnly
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-600"
            />
          </div>
          <textarea
            value={decisionForm.note}
            onChange={(event) => setDecisionForm((current) => ({ ...current, note: event.target.value }))}
            rows={3}
            placeholder={
              showDecisionForm === "approved"
                ? "Optional note for the admins"
                : "Optional reason for denying this item"
            }
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDecisionForm(null)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !decisionForm.response_date}
              onClick={() => void handleSubmitDecision()}
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                showDecisionForm === "approved" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {showDecisionForm === "approved" ? "Confirm Approval" : "Confirm Denial"}
            </button>
          </div>
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
