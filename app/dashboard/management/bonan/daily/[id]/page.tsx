
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeDailyReportPayload,
  type DailyReportPayload,
  type BonanReportStatus,
  type CoverageMatrixRow,
  type ChecklistItem,
  type IncidentEntry,
  type FridgeTempEntry,
  type FireAlarmLogEntry,
} from "@/lib/bonan-types";
import {
  formatUsCentralDateTime,
  formatUsCentralTime,
  getUsCentralDate,
} from "@/lib/us-central-time";

interface BonanDailyReport {
  id: string;
  report_type: "daily" | "weekly" | "monthly";
  status: BonanReportStatus;
  report_date: string;
  work_order_id: string | null;
  work_order_number?: string;
  payload: DailyReportPayload;
  created_at: string;
  updated_at: string;
  last_autosaved_at: string | null;
  submitted_at: string | null;
}

interface AssociatedWorkOrder {
  id: string;
  bonan_report_id: string;
  work_order_id: string;
  work_order_number: string;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "emergency" | "high" | "normal" | "low";
  description: string;
  created_at: string;
}

const STEP_TITLES = [
  "Coverage Matrix",
  "Critical Systems",
  "Incident + Fridge",
  "Fire Alarm + Review",
];

const STATUS_LABELS: Record<BonanReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
};

const STATUS_STYLES: Record<BonanReportStatus, string> = {
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-green-100 text-green-700",
};

type DraftSyncState = "idle" | "cached" | "queued" | "syncing";

interface LocalDraftRecord {
  payload: DailyReportPayload;
  savedAt: string;
  serverUpdatedAt: string | null;
}

const DRAFT_CACHE_PREFIX = "bonan-daily-draft-v1";
const DRAFT_QUEUE_PREFIX = "bonan-daily-queue-v1";

function getDraftCacheKey(reportId: string): string {
  return `${DRAFT_CACHE_PREFIX}:${reportId}`;
}

function getDraftQueueKey(reportId: string): string {
  return `${DRAFT_QUEUE_PREFIX}:${reportId}`;
}

function readLocalDraftRecord(storageKey: string): LocalDraftRecord | null {
  if (typeof window === "undefined") return null;
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Partial<LocalDraftRecord>;
    if (!parsed || typeof parsed !== "object" || !parsed.payload || typeof parsed.savedAt !== "string") {
      return null;
    }

    return {
      payload: normalizeDailyReportPayload(parsed.payload),
      savedAt: parsed.savedAt,
      serverUpdatedAt:
        typeof parsed.serverUpdatedAt === "string" || parsed.serverUpdatedAt === null
          ? parsed.serverUpdatedAt
          : null,
    };
  } catch {
    return null;
  }
}

function writeLocalDraftRecord(storageKey: string, record: LocalDraftRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(record));
}

function clearLocalDraftRecord(storageKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}

function isSavedAfterServer(savedAt: string, serverUpdatedAt: string | null | undefined): boolean {
  const savedTime = new Date(savedAt).getTime();
  const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
  if (!Number.isFinite(savedTime)) return false;
  if (!Number.isFinite(serverTime)) return true;
  return savedTime > serverTime;
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function BonanDailyReportEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<BonanDailyReport | null>(null);
  const [payload, setPayload] = useState<DailyReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [associatedWorkOrders, setAssociatedWorkOrders] = useState<AssociatedWorkOrder[]>([]);
  const [creatingAssociatedWorkOrder, setCreatingAssociatedWorkOrder] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [showDeleteDailyWarning, setShowDeleteDailyWarning] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteReportError, setDeleteReportError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<DraftSyncState>("idle");
  const [lastCachedAt, setLastCachedAt] = useState("");

  const isReadOnly = report?.status === "submitted";
  const draftCacheKey = useMemo(() => getDraftCacheKey(id), [id]);
  const draftQueueKey = useMemo(() => getDraftQueueKey(id), [id]);

  const queueDraftForSync = useCallback(
    (draftPayload: DailyReportPayload) => {
      const nowIso = new Date().toISOString();
      writeLocalDraftRecord(draftQueueKey, {
        payload: draftPayload,
        savedAt: nowIso,
        serverUpdatedAt: report?.updated_at ?? null,
      });
      writeLocalDraftRecord(draftCacheKey, {
        payload: draftPayload,
        savedAt: nowIso,
        serverUpdatedAt: report?.updated_at ?? null,
      });

      setDirty(true);
      setSyncState("queued");
      setLastCachedAt(formatUsCentralTime(nowIso));
      setSaveMessage("Offline: saved to this device. Pending sync.");
      setError("");
    },
    [draftCacheKey, draftQueueKey, report?.updated_at]
  );

  const persistDraftToServer = useCallback(
    async (draftPayload: DailyReportPayload): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch(`/api/bonan/reports/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payload: draftPayload,
            status: "draft",
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to save draft.");
          return false;
        }

        const normalizedPayload = normalizeDailyReportPayload(data.report.payload);
        const savedAt = new Date();
        setReport({
          ...(data.report as Omit<BonanDailyReport, "payload">),
          payload: normalizedPayload,
        });
        setPayload(normalizedPayload);
        setDirty(false);
        setSyncState("idle");
        setLastCachedAt(formatUsCentralTime(savedAt));
        clearLocalDraftRecord(draftQueueKey);
        writeLocalDraftRecord(draftCacheKey, {
          payload: normalizedPayload,
          savedAt: savedAt.toISOString(),
          serverUpdatedAt: data.report.updated_at ?? null,
        });
        setSaveMessage(`Saved at ${formatUsCentralTime(savedAt)} CT`);
        return true;
      } catch (saveError) {
        console.error("Failed to autosave Bonan daily report:", saveError);
        queueDraftForSync(draftPayload);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draftCacheKey, draftQueueKey, id, queueDraftForSync]
  );

  const flushQueuedDraft = useCallback(async () => {
    if (!report || report.status !== "draft") return;
    const queuedDraft = readLocalDraftRecord(draftQueueKey);
    if (!queuedDraft) {
      setSyncState((current) => (current === "syncing" ? "idle" : current));
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncState("queued");
      return;
    }

    setSyncState("syncing");
    await persistDraftToServer(queuedDraft.payload);
  }, [draftQueueKey, persistDraftToServer, report]);

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();

        if (!sessionData.user) {
          router.push("/login");
          return;
        }
        if (sessionData.user.role === "client") {
          router.push("/dashboard");
          return;
        }
        setUserRole(sessionData.user.role);

        const reportRes = await fetch(`/api/bonan/reports/${id}`);
        const reportData = await reportRes.json();

        if (!reportRes.ok) {
          setError(reportData.error || "Failed to load Bonan daily report.");
          return;
        }

        if (reportData.report.report_type !== "daily") {
          router.push("/dashboard/bonan/daily");
          return;
        }

        const normalizedPayload = normalizeDailyReportPayload(reportData.report.payload);
        const queuedDraft = readLocalDraftRecord(draftQueueKey);
        const cachedDraft = readLocalDraftRecord(draftCacheKey);

        let initialPayload = normalizedPayload;
        if (reportData.report.status === "draft") {
          if (queuedDraft) {
            initialPayload = queuedDraft.payload;
            setDirty(true);
            setSyncState("queued");
            setSaveMessage("Recovered offline draft. Sync will resume when online.");
            setLastCachedAt(formatUsCentralTime(queuedDraft.savedAt));
          } else if (cachedDraft && isSavedAfterServer(cachedDraft.savedAt, reportData.report.updated_at)) {
            initialPayload = cachedDraft.payload;
            setDirty(true);
            setSyncState("cached");
            setSaveMessage("Recovered local draft.");
            setLastCachedAt(formatUsCentralTime(cachedDraft.savedAt));
          }
        }

        setReport({
          ...(reportData.report as Omit<BonanDailyReport, "payload">),
          payload: initialPayload,
        });
        setPayload(initialPayload);

        try {
          const associatedRes = await fetch(`/api/bonan/reports/${id}/work-orders`);
          const associatedData = await associatedRes.json();
          if (associatedRes.ok) {
            setAssociatedWorkOrders(associatedData.associatedWorkOrders || []);
          }
        } catch (associatedError) {
          console.error("Failed to load associated work orders:", associatedError);
        }
      } catch (fetchError) {
        console.error("Failed to initialize Bonan daily report editor:", fetchError);
        setError("Failed to load Bonan daily report.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [draftCacheKey, draftQueueKey, id, router]);

  const saveDraft = useCallback(async () => {
    if (!payload || !report || report.status !== "draft") return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueDraftForSync(payload);
      return;
    }

    await persistDraftToServer(payload);
  }, [payload, persistDraftToServer, queueDraftForSync, report]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(window.navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      if (readLocalDraftRecord(draftQueueKey)) {
        setSaveMessage("Connection restored. Syncing pending changes...");
      }
      void flushQueuedDraft();
    }

    function handleOffline() {
      setIsOnline(false);
      setSyncState((current) => (current === "syncing" ? "queued" : current));
      setSaveMessage("Offline mode: changes are cached locally.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [draftQueueKey, flushQueuedDraft]);

  useEffect(() => {
    if (!payload || !report || report.status !== "draft") return;
    const timer = window.setTimeout(() => {
      const nowIso = new Date().toISOString();
      writeLocalDraftRecord(draftCacheKey, {
        payload,
        savedAt: nowIso,
        serverUpdatedAt: report.updated_at,
      });
      setLastCachedAt(formatUsCentralTime(nowIso));
      if (syncState === "idle" && dirty) {
        setSyncState("cached");
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [dirty, draftCacheKey, payload, report, syncState]);

  useEffect(() => {
    if (!report || report.status !== "draft" || !isOnline) return;
    if (!readLocalDraftRecord(draftQueueKey)) return;
    void flushQueuedDraft();
  }, [draftQueueKey, flushQueuedDraft, isOnline, report]);

  useEffect(() => {
    if (!dirty || !payload || !report || report.status !== "draft") return;

    const timer = setTimeout(() => {
      void saveDraft();
    }, 30000);

    return () => clearTimeout(timer);
  }, [dirty, payload, report, saveDraft]);

  function updatePayload(updater: (current: DailyReportPayload) => DailyReportPayload) {
    setPayload((current) => {
      if (!current) return current;
      const next = updater(current);
      setDirty(true);
      setSaveMessage("Unsaved changes");
      return next;
    });
  }

  function updateMetadata<K extends keyof DailyReportPayload["metadata"]>(
    key: K,
    value: DailyReportPayload["metadata"][K]
  ) {
    updatePayload((current) => ({
      ...current,
      metadata: {
        ...current.metadata,
        [key]: value,
      },
    }));
  }

  function updateCoverageRow<K extends keyof CoverageMatrixRow>(
    index: number,
    key: K,
    value: CoverageMatrixRow[K]
  ) {
    updatePayload((current) => ({
      ...current,
      coverageMatrix: current.coverageMatrix.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function updateChecklistRow(
    field: "commonAreas" | "riskControls",
    index: number,
    nextValue: Partial<ChecklistItem>
  ) {
    updatePayload((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...nextValue } : item
      ),
    }));
  }

  function updateIncidentRow<K extends keyof IncidentEntry>(
    index: number,
    key: K,
    value: IncidentEntry[K]
  ) {
    updatePayload((current) => ({
      ...current,
      incidents: current.incidents.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function addIncidentRow() {
    updatePayload((current) => ({
      ...current,
      incidents: [
        ...current.incidents,
        { time: "", systemArea: "", description: "", actionsTaken: "", workOrderOrVendor: "" },
      ],
    }));
  }

  function removeIncidentRow(index: number) {
    updatePayload((current) => ({
      ...current,
      incidents: current.incidents.length <= 1
        ? current.incidents
        : current.incidents.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateFridgeRow<K extends keyof FridgeTempEntry>(
    index: number,
    key: K,
    value: FridgeTempEntry[K]
  ) {
    updatePayload((current) => ({
      ...current,
      fridgeLogs: current.fridgeLogs.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function addFridgeRow() {
    const reportDate = payload?.metadata.date || getUsCentralDate();
    updatePayload((current) => ({
      ...current,
      fridgeLogs: [
        ...current.fridgeLogs,
        {
          date: reportDate,
          time: "",
          tempF: "",
          withinTarget: "Y",
          correctiveAction: "",
          initials: "",
        },
      ],
    }));
  }

  function removeFridgeRow(index: number) {
    updatePayload((current) => ({
      ...current,
      fridgeLogs: current.fridgeLogs.length <= 1
        ? current.fridgeLogs
        : current.fridgeLogs.filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  function updateFireAlarmMeta<K extends keyof DailyReportPayload["fireAlarmMeta"]>(
    key: K,
    value: DailyReportPayload["fireAlarmMeta"][K]
  ) {
    updatePayload((current) => ({
      ...current,
      fireAlarmMeta: {
        ...current.fireAlarmMeta,
        [key]: value,
      },
    }));
  }

  function updateFireAlarmRow<K extends keyof FireAlarmLogEntry>(
    index: number,
    key: K,
    value: FireAlarmLogEntry[K]
  ) {
    updatePayload((current) => ({
      ...current,
      fireAlarmEntries: current.fireAlarmEntries.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row
      ),
    }));
  }

  function addFireAlarmRow() {
    updatePayload((current) => ({
      ...current,
      fireAlarmEntries: [
        ...current.fireAlarmEntries,
        {
          date: "",
          time: "",
          panel: "",
          type: "",
          messageZone: "",
          actionTaken: "",
          cleared: false,
          workOrderNumber: "",
        },
      ],
    }));
  }

  function removeFireAlarmRow(index: number) {
    updatePayload((current) => ({
      ...current,
      fireAlarmEntries: current.fireAlarmEntries.length <= 1
        ? current.fireAlarmEntries
        : current.fireAlarmEntries.filter((_, rowIndex) => rowIndex !== index),
    }));
  }
  async function handleSubmitReport() {
    if (!payload || !report || submitting) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueDraftForSync(payload);
      setError("You are offline. Draft is cached locally and will sync when connection returns.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/bonan/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          status: "submitted",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit report.");
        return;
      }

      const normalizedPayload = normalizeDailyReportPayload(data.report.payload);
      setReport({
        ...(data.report as Omit<BonanDailyReport, "payload">),
        payload: normalizedPayload,
      });
      setPayload(normalizedPayload);
      setDirty(false);
      setSyncState("idle");
      clearLocalDraftRecord(draftQueueKey);
      writeLocalDraftRecord(draftCacheKey, {
        payload: normalizedPayload,
        savedAt: new Date().toISOString(),
        serverUpdatedAt: data.report.updated_at ?? null,
      });
      setSaveMessage(`Submitted at ${formatUsCentralTime(new Date())} CT`);
    } catch (submitError) {
      console.error("Failed to submit Bonan daily report:", submitError);
      setError("Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshAssociatedWorkOrders() {
    try {
      const associatedRes = await fetch(`/api/bonan/reports/${id}/work-orders`);
      const associatedData = await associatedRes.json();
      if (associatedRes.ok) {
        setAssociatedWorkOrders(associatedData.associatedWorkOrders || []);
      }
    } catch (fetchError) {
      console.error("Failed to refresh associated work orders:", fetchError);
    }
  }

  async function handleCreateAssociatedWorkOrder() {
    if (!report || creatingAssociatedWorkOrder) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You are offline. Reconnect to create a linked work order.");
      return;
    }

    setCreatingAssociatedWorkOrder(true);
    setError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `Bonan Daily Walk-Through Deficiency Follow-up (${report.report_date})`,
          location: "Bonan Towers",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create associated work order.");
        return;
      }

      await refreshAssociatedWorkOrders();
      router.push(`/dashboard/management/work-orders/${data.associatedWorkOrder.work_order_id}`);
    } catch (createError) {
      console.error("Failed to create associated work order:", createError);
      setError("Failed to create associated work order.");
    } finally {
      setCreatingAssociatedWorkOrder(false);
    }
  }

  function openDeleteDailyReportWarning() {
    if (!report || userRole !== "admin" || deletingReport) return;
    setShowDeleteDailyWarning(true);
    setDeleteConfirmInput("");
    setDeleteReportError("");
  }

  async function handleDeleteDailyReport() {
    if (!report || userRole !== "admin" || deletingReport) return;
    if (deleteConfirmInput.trim() !== report.report_date) {
      setDeleteReportError(`Type ${report.report_date} to confirm deletion.`);
      return;
    }

    setDeletingReport(true);
    setError("");
    setDeleteReportError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteReportError(data.error || "Failed to delete daily report.");
        return;
      }
      setShowDeleteDailyWarning(false);
      setDeleteConfirmInput("");
      router.push("/dashboard/bonan/daily");
    } catch (deleteError) {
      console.error("Failed to delete daily report:", deleteError);
      setDeleteReportError("Failed to delete daily report.");
    } finally {
      setDeletingReport(false);
    }
  }

  const completedCoverage = useMemo(() => {
    if (!payload) return 0;
    return payload.coverageMatrix.filter(
      (row) => row.restrooms !== "NA" || row.fountain !== "NA" || row.elecCloset !== "NA"
    ).length;
  }, [payload]);

  const syncStatusText = useMemo(() => {
    if (!isOnline) {
      return lastCachedAt
        ? `Offline mode. Last cached at ${lastCachedAt} CT.`
        : "Offline mode. Changes are cached on this device.";
    }
    if (syncState === "syncing") {
      return "Connection restored. Syncing cached changes...";
    }
    if (syncState === "queued") {
      return "Draft changes are queued and will sync automatically.";
    }
    if (syncState === "cached") {
      return lastCachedAt ? `Draft cached locally at ${lastCachedAt} CT.` : "Draft cached locally.";
    }
    return "";
  }, [isOnline, lastCachedAt, syncState]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg)">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-(--text)"></div>
      </div>
    );
  }

  if (!report || !payload) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <p className="text-red-700">{error || "Bonan daily report could not be loaded."}</p>
          <Link
            href="/dashboard/bonan/daily"
            className="inline-flex rounded-full border border-(--border)/30 px-4 py-2 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
          >
            Return to Daily Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg)">
      <div className="w-full px-2 md:px-3 lg:px-4 py-6 pb-28 md:pb-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-(--text)/55">
                Bonan Towers Daily Walk-Through
              </p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[report.status]}`}>
                {STATUS_LABELS[report.status]}
              </span>
              {report.work_order_number && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  WO #{report.work_order_number}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-(--text)">Daily Report - {report.report_date}</h1>
            <p className="text-sm text-(--text)/60">
              Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:justify-end">
            <Link
              href="/dashboard/bonan/daily"
              className="rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
            >
              Back to List
            </Link>
            <button
              type="button"
              onClick={() => void handleCreateAssociatedWorkOrder()}
              disabled={creatingAssociatedWorkOrder}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-60"
            >
              {creatingAssociatedWorkOrder ? "Creating WO..." : "Create Work Order"}
            </button>
            {report.work_order_id && (
              <Link
                href={`/dashboard/management/work-orders/${report.work_order_id}`}
                target="_blank"
                className="rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition"
              >
                Open Linked WO
              </Link>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
            )}
            {userRole === "admin" && (
              <button
                type="button"
                onClick={() => openDeleteDailyReportWarning()}
                disabled={deletingReport}
                className="rounded-full border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:opacity-60"
              >
                {deletingReport ? "Deleting..." : "Delete Daily Report"}
              </button>
            )}
            {!isReadOnly && step === STEP_TITLES.length - 1 && (
              <button
                type="button"
                onClick={() => void handleSubmitReport()}
                disabled={submitting}
                className="tl-btn px-4 py-2.5 text-sm disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit Daily Report"}
              </button>
            )}
          </div>
        </div>

        <div className="tl-card p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-wrap gap-2">
              {STEP_TITLES.map((title, index) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={classNames(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    step === index
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-(--border)/40 text-(--text)/70 hover:bg-(--bg)"
                  )}
                >
                  {index + 1}. {title}
                </button>
              ))}
            </div>
            <p className="text-xs text-(--text)/55">
              {isReadOnly
                ? `Submitted ${report.submitted_at ? `${formatUsCentralDateTime(report.submitted_at)} CT` : ""}`
                : `Autosave: every 30s after changes. ${saveMessage}`}
            </p>
          </div>
        </div>

        {syncStatusText && (
          <div
            className={classNames(
              "rounded-xl border px-4 py-3 text-sm",
              !isOnline
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : syncState === "syncing"
                  ? "border-blue-200 bg-blue-50 text-blue-800"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            )}
          >
            {syncStatusText}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="tl-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-(--text)">Associated Work Reports</h2>
            <button
              type="button"
              onClick={() => void handleCreateAssociatedWorkOrder()}
              disabled={creatingAssociatedWorkOrder}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-60"
            >
              {creatingAssociatedWorkOrder ? "Creating..." : "+ Create Work Order"}
            </button>
          </div>
          {associatedWorkOrders.length === 0 ? (
            <p className="text-sm text-(--text)/60">
              No additional work reports are linked yet.
            </p>
          ) : (
            <div className="space-y-2">
              {associatedWorkOrders.map((associated) => (
                <Link
                  key={associated.id}
                  href={`/dashboard/management/work-orders/${associated.work_order_id}`}
                  className="block rounded-xl border border-(--border)/40 px-4 py-3 hover:bg-(--bg) transition"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-(--text)">
                        WO #{associated.work_order_number}
                      </p>
                      <p className="text-xs text-(--text)/60 mt-1 line-clamp-1">
                        {associated.description}
                      </p>
                    </div>
                    <div className="text-right text-xs text-(--text)/55">
                      <p className="capitalize">{associated.work_completed.replace("_", " ")}</p>
                      <p className="mt-1 capitalize">{associated.priority} priority</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="tl-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-(--text)">Header</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Date</span>
              <input
                type="date"
                value={payload.metadata.date}
                onChange={(event) => updateMetadata("date", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Start</span>
              <input
                type="time"
                value={payload.metadata.start}
                onChange={(event) => updateMetadata("start", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">End</span>
              <input
                type="time"
                value={payload.metadata.end}
                onChange={(event) => updateMetadata("end", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Inspector</span>
              <input
                type="text"
                value={payload.metadata.inspector}
                onChange={(event) => updateMetadata("inspector", event.target.value)}
                disabled={isReadOnly}
                placeholder="Inspector name"
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Towers</span>
              <select
                value={payload.metadata.towers}
                onChange={(event) => updateMetadata("towers", event.target.value as DailyReportPayload["metadata"]["towers"])}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              >
                <option value="north">North</option>
                <option value="south">South</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Weather</span>
              <input
                type="text"
                value={payload.metadata.weather}
                onChange={(event) => updateMetadata("weather", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Shift</span>
              <input
                type="text"
                value={payload.metadata.shift}
                onChange={(event) => updateMetadata("shift", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Supervisor Review</span>
              <input
                type="text"
                value={payload.metadata.supervisorReview}
                onChange={(event) => updateMetadata("supervisorReview", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Work Orders Created (WO#)</span>
              <input
                type="text"
                value={payload.metadata.workOrdersCreated}
                onChange={(event) => updateMetadata("workOrdersCreated", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-(--text)/70">Signature (typed)</span>
              <input
                type="text"
                value={payload.metadata.signature}
                onChange={(event) => updateMetadata("signature", event.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
              />
            </label>
          </div>
        </section>

        {step === 0 && (
          <>
            <section className="tl-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-(--text)">Daily Walk-Through - Coverage Matrix</h2>
                <span className="text-xs text-(--text)/60">{completedCoverage} / {payload.coverageMatrix.length} rows reviewed</span>
              </div>
              <p className="text-sm text-(--text)/60">
                Mark each area as O (OK), D (Deficiency), or NA.
              </p>
              <div className="xl:hidden space-y-3">
                {payload.coverageMatrix.map((row, index) => (
                  <div key={row.area} className="rounded-xl border border-(--border)/40 p-3 space-y-3">
                    <p className="text-sm font-semibold text-(--text)">{row.area}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Restrooms (M/W)</span>
                        <select
                          value={row.restrooms}
                          onChange={(event) =>
                            updateCoverageRow(index, "restrooms", event.target.value as CoverageMatrixRow["restrooms"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        >
                          <option value="O">O</option>
                          <option value="D">D</option>
                          <option value="NA">NA</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Fountain</span>
                        <select
                          value={row.fountain}
                          onChange={(event) =>
                            updateCoverageRow(index, "fountain", event.target.value as CoverageMatrixRow["fountain"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        >
                          <option value="O">O</option>
                          <option value="D">D</option>
                          <option value="NA">NA</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Elec Closet</span>
                        <select
                          value={row.elecCloset}
                          onChange={(event) =>
                            updateCoverageRow(index, "elecCloset", event.target.value as CoverageMatrixRow["elecCloset"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        >
                          <option value="O">O</option>
                          <option value="D">D</option>
                          <option value="NA">NA</option>
                        </select>
                      </label>
                    </div>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Notes / WO#</span>
                      <input
                        type="text"
                        value={row.notes}
                        onChange={(event) => updateCoverageRow(index, "notes", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Initials</span>
                      <input
                        type="text"
                        value={row.initials}
                        onChange={(event) => updateCoverageRow(index, "initials", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-x-auto">
                <table className="min-w-[980px] w-full border border-(--border)/40 text-sm">
                  <thead className="bg-slate-100 text-(--text)">
                    <tr>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Area</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Restrooms (M/W)</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Fountain</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Elec Closet</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Notes / WO#</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Initials</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.coverageMatrix.map((row, index) => (
                      <tr key={row.area}>
                        <td className="border border-(--border)/40 px-2 py-2 font-medium text-(--text)">{row.area}</td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <select
                            value={row.restrooms}
                            onChange={(event) =>
                              updateCoverageRow(index, "restrooms", event.target.value as CoverageMatrixRow["restrooms"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          >
                            <option value="O">O</option>
                            <option value="D">D</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <select
                            value={row.fountain}
                            onChange={(event) =>
                              updateCoverageRow(index, "fountain", event.target.value as CoverageMatrixRow["fountain"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          >
                            <option value="O">O</option>
                            <option value="D">D</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <select
                            value={row.elecCloset}
                            onChange={(event) =>
                              updateCoverageRow(index, "elecCloset", event.target.value as CoverageMatrixRow["elecCloset"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          >
                            <option value="O">O</option>
                            <option value="D">D</option>
                            <option value="NA">NA</option>
                          </select>
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(event) => updateCoverageRow(index, "notes", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.initials}
                            onChange={(event) => updateCoverageRow(index, "initials", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Daily - Atrium & Common Areas</h2>
              <div className="space-y-4">
                {payload.commonAreas.map((item, index) => (
                  <div key={item.label} className="rounded-xl border border-(--border)/40 p-4 space-y-2">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => updateChecklistRow("commonAreas", index, { checked: event.target.checked })}
                        disabled={isReadOnly}
                        className="mt-1 h-4 w-4 rounded border-(--border)"
                      />
                      <span className="text-sm text-(--text)">{item.label}</span>
                    </label>
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateChecklistRow("commonAreas", index, { notes: event.target.value })}
                      disabled={isReadOnly}
                      rows={2}
                      placeholder="Notes / WO#"
                      className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {step === 1 && (
          <>
            <section className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Daily Walk-Through - Critical Systems & Life Safety</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Pump Room (F)</span>
                  <input
                    type="text"
                    value={payload.temperatures.pumpRoom}
                    onChange={(event) =>
                      updatePayload((current) => ({
                        ...current,
                        temperatures: { ...current.temperatures, pumpRoom: event.target.value },
                      }))
                    }
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Boiler Room (F)</span>
                  <input
                    type="text"
                    value={payload.temperatures.boilerRoom}
                    onChange={(event) =>
                      updatePayload((current) => ({
                        ...current,
                        temperatures: { ...current.temperatures, boilerRoom: event.target.value },
                      }))
                    }
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Atrium (F)</span>
                  <input
                    type="text"
                    value={payload.temperatures.atrium}
                    onChange={(event) =>
                      updatePayload((current) => ({
                        ...current,
                        temperatures: { ...current.temperatures, atrium: event.target.value },
                      }))
                    }
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
              </div>
            </section>

            <section className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Daily - Risk Controls (Insurance Review)</h2>
              <div className="space-y-4">
                {payload.riskControls.map((item, index) => (
                  <div key={item.label} className="rounded-xl border border-(--border)/40 p-4 space-y-2">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => updateChecklistRow("riskControls", index, { checked: event.target.checked })}
                        disabled={isReadOnly}
                        className="mt-1 h-4 w-4 rounded border-(--border)"
                      />
                      <span className="text-sm text-(--text)">{item.label}</span>
                    </label>
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateChecklistRow("riskControls", index, { notes: event.target.value })}
                      disabled={isReadOnly}
                      rows={2}
                      placeholder="Notes / WO#"
                      className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <section className="tl-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-(--text)">Incident / Alarm / Shutdown Record</h2>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addIncidentRow}
                    className="rounded-full border border-(--border)/40 px-3 py-1.5 text-xs font-semibold text-(--text) hover:bg-(--bg) transition"
                  >
                    + Add Row
                  </button>
                )}
              </div>
              <p className="text-sm text-(--text)/60">
                Use for alarms, leaks, shutdowns, and safety incidents. Include WO# or vendor reference where possible.
              </p>
              <div className="xl:hidden space-y-3">
                {payload.incidents.map((row, index) => (
                  <div key={`${index}-${row.time}-${row.systemArea}`} className="rounded-xl border border-(--border)/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Time</span>
                        <input
                          type="text"
                          value={row.time}
                          onChange={(event) => updateIncidentRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">System / Area</span>
                        <input
                          type="text"
                          value={row.systemArea}
                          onChange={(event) => updateIncidentRow(index, "systemArea", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        />
                      </label>
                    </div>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Description</span>
                      <textarea
                        value={row.description}
                        onChange={(event) => updateIncidentRow(index, "description", event.target.value)}
                        disabled={isReadOnly}
                        rows={2}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Actions Taken</span>
                      <textarea
                        value={row.actionsTaken}
                        onChange={(event) => updateIncidentRow(index, "actionsTaken", event.target.value)}
                        disabled={isReadOnly}
                        rows={2}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">WO# / Vendor</span>
                      <input
                        type="text"
                        value={row.workOrderOrVendor}
                        onChange={(event) => updateIncidentRow(index, "workOrderOrVendor", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeIncidentRow(index)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                      >
                        Remove Row
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-x-auto">
                <table className="min-w-[1080px] w-full border border-(--border)/40 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Time</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">System / Area</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Description</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Actions Taken</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">WO# / Vendor</th>
                      {!isReadOnly && <th className="border border-(--border)/40 px-2 py-2 text-left">Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payload.incidents.map((row, index) => (
                      <tr key={`${index}-${row.time}-${row.systemArea}`}>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.time}
                            onChange={(event) => updateIncidentRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.systemArea}
                            onChange={(event) => updateIncidentRow(index, "systemArea", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <textarea
                            value={row.description}
                            onChange={(event) => updateIncidentRow(index, "description", event.target.value)}
                            disabled={isReadOnly}
                            rows={2}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <textarea
                            value={row.actionsTaken}
                            onChange={(event) => updateIncidentRow(index, "actionsTaken", event.target.value)}
                            disabled={isReadOnly}
                            rows={2}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.workOrderOrVendor}
                            onChange={(event) => updateIncidentRow(index, "workOrderOrVendor", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="border border-(--border)/40 px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeIncidentRow(index)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="space-y-1 text-sm block">
                <span className="text-(--text)/70">Documentation Reference</span>
                <textarea
                  value={payload.incidentDocumentationReference}
                  onChange={(event) =>
                    updatePayload((current) => ({
                      ...current,
                      incidentDocumentationReference: event.target.value,
                    }))
                  }
                  disabled={isReadOnly}
                  rows={3}
                  className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                />
              </label>
            </section>

            <section className="tl-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-(--text)">Daily - Retail Fridge Temperature Log</h2>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addFridgeRow}
                    className="rounded-full border border-(--border)/40 px-3 py-1.5 text-xs font-semibold text-(--text) hover:bg-(--bg) transition"
                  >
                    + Add Reading
                  </button>
                )}
              </div>
              <p className="text-sm text-(--text)/60">
                Target range: 34-41F. Record corrective action for out-of-range readings.
              </p>
              <div className="xl:hidden space-y-3">
                {payload.fridgeLogs.map((row, index) => (
                  <div key={`${index}-${row.date}-${row.time}`} className="rounded-xl border border-(--border)/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Date</span>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateFridgeRow(index, "date", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Time</span>
                        <input
                          type="time"
                          value={row.time}
                          onChange={(event) => updateFridgeRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Temp (F)</span>
                        <input
                          type="text"
                          value={row.tempF}
                          onChange={(event) => updateFridgeRow(index, "tempF", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Within Target?</span>
                        <select
                          value={row.withinTarget}
                          onChange={(event) =>
                            updateFridgeRow(index, "withinTarget", event.target.value as FridgeTempEntry["withinTarget"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </label>
                    </div>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Corrective Action / Notes</span>
                      <input
                        type="text"
                        value={row.correctiveAction}
                        onChange={(event) => updateFridgeRow(index, "correctiveAction", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Initials</span>
                      <input
                        type="text"
                        value={row.initials}
                        onChange={(event) => updateFridgeRow(index, "initials", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 text-(--text) bg-white disabled:opacity-70"
                      />
                    </label>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeFridgeRow(index)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                      >
                        Remove Reading
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-x-auto">
                <table className="min-w-[980px] w-full border border-(--border)/40 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Date</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Time</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Temp (F)</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Within Target?</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Corrective Action / Notes</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Initials</th>
                      {!isReadOnly && <th className="border border-(--border)/40 px-2 py-2 text-left">Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payload.fridgeLogs.map((row, index) => (
                      <tr key={`${index}-${row.date}-${row.time}`}>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(event) => updateFridgeRow(index, "date", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="time"
                            value={row.time}
                            onChange={(event) => updateFridgeRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.tempF}
                            onChange={(event) => updateFridgeRow(index, "tempF", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <select
                            value={row.withinTarget}
                            onChange={(event) =>
                              updateFridgeRow(index, "withinTarget", event.target.value as FridgeTempEntry["withinTarget"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.correctiveAction}
                            onChange={(event) => updateFridgeRow(index, "correctiveAction", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.initials}
                            onChange={(event) => updateFridgeRow(index, "initials", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 text-(--text) bg-white disabled:opacity-70"
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="border border-(--border)/40 px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFridgeRow(index)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {step === 3 && (
          <>
            <section className="tl-card p-6 space-y-4">
              <h2 className="text-lg font-semibold text-(--text)">Fire Alarm Panel Status & Trouble Log</h2>
              <p className="text-sm text-(--text)/60">
                Panels: Main (Sprinkler Pump Room) and Sub-Panel (outside Boiler Room). Escalation: active alarm/smoke/fire -&gt; call 911 and follow site procedure.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Date Range</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.dateRange}
                    onChange={(event) => updateFireAlarmMeta("dateRange", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Prepared By</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.preparedBy}
                    onChange={(event) => updateFireAlarmMeta("preparedBy", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Supervisor Review</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.supervisorReview}
                    onChange={(event) => updateFireAlarmMeta("supervisorReview", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-(--text)/70">Signature</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.signature}
                    onChange={(event) => updateFireAlarmMeta("signature", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-xl border border-(--border) bg-(--bg) px-3 py-2 text-(--text) focus:outline-none focus:ring-2 focus:ring-(--ring) disabled:opacity-70"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
                <h3 className="text-sm font-semibold text-(--text)">Event Log</h3>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addFireAlarmRow}
                    className="rounded-full border border-(--border)/40 px-3 py-1.5 text-xs font-semibold text-(--text) hover:bg-(--bg) transition"
                  >
                    + Add Fire Alarm Row
                  </button>
                )}
              </div>

              <div className="xl:hidden space-y-3">
                {payload.fireAlarmEntries.map((row, index) => (
                  <div key={`${index}-${row.date}-${row.time}`} className="rounded-xl border border-(--border)/40 p-3 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Date</span>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateFireAlarmRow(index, "date", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Time</span>
                        <input
                          type="time"
                          value={row.time}
                          onChange={(event) => updateFireAlarmRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Panel</span>
                        <input
                          type="text"
                          value={row.panel}
                          onChange={(event) => updateFireAlarmRow(index, "panel", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">Type</span>
                        <input
                          type="text"
                          value={row.type}
                          onChange={(event) => updateFireAlarmRow(index, "type", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                        />
                      </label>
                    </div>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Message / Zone</span>
                      <input
                        type="text"
                        value={row.messageZone}
                        onChange={(event) => updateFireAlarmRow(index, "messageZone", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                      />
                    </label>
                    <label className="space-y-1 text-xs block">
                      <span className="text-(--text)/65">Action Taken</span>
                      <input
                        type="text"
                        value={row.actionTaken}
                        onChange={(event) => updateFireAlarmRow(index, "actionTaken", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                      />
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 text-xs">
                        <span className="text-(--text)/65">WO#</span>
                        <input
                          type="text"
                          value={row.workOrderNumber}
                          onChange={(event) => updateFireAlarmRow(index, "workOrderNumber", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-md border border-(--border) px-2 py-1.5 bg-white text-(--text) disabled:opacity-70"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-(--text) mt-5 sm:mt-0">
                        <input
                          type="checkbox"
                          checked={row.cleared}
                          onChange={(event) => updateFireAlarmRow(index, "cleared", event.target.checked)}
                          disabled={isReadOnly}
                          className="h-4 w-4 rounded border-(--border)"
                        />
                        Cleared
                      </label>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => removeFireAlarmRow(index)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                      >
                        Remove Entry
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-x-auto">
                <table className="min-w-[1150px] w-full border border-(--border)/40 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Date</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Time</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Panel</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Type</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Message / Zone</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Action Taken</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">Cleared</th>
                      <th className="border border-(--border)/40 px-2 py-2 text-left">WO#</th>
                      {!isReadOnly && <th className="border border-(--border)/40 px-2 py-2 text-left">Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payload.fireAlarmEntries.map((row, index) => (
                      <tr key={`${index}-${row.date}-${row.time}`}>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(event) => updateFireAlarmRow(index, "date", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="time"
                            value={row.time}
                            onChange={(event) => updateFireAlarmRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.panel}
                            onChange={(event) => updateFireAlarmRow(index, "panel", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.type}
                            onChange={(event) => updateFireAlarmRow(index, "type", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.messageZone}
                            onChange={(event) => updateFireAlarmRow(index, "messageZone", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.actionTaken}
                            onChange={(event) => updateFireAlarmRow(index, "actionTaken", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.cleared}
                            onChange={(event) => updateFireAlarmRow(index, "cleared", event.target.checked)}
                            disabled={isReadOnly}
                            className="h-4 w-4 rounded border-(--border)"
                          />
                        </td>
                        <td className="border border-(--border)/40 px-2 py-2">
                          <input
                            type="text"
                            value={row.workOrderNumber}
                            onChange={(event) => updateFireAlarmRow(index, "workOrderNumber", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-md border border-(--border) px-2 py-1 bg-white text-(--text) disabled:opacity-70"
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="border border-(--border)/40 px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFireAlarmRow(index)}
                              className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                            >
                              Remove
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tl-card p-6 space-y-3">
              <h2 className="text-lg font-semibold text-(--text)">Submission Review</h2>
              <p className="text-sm text-(--text)/70">
                Confirm all four sections are complete before submitting. Submission notifies admins and linked stakeholders.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-(--border)/40 p-3">
                  <p className="font-medium text-(--text)">Coverage rows logged</p>
                  <p className="text-(--text)/70 mt-1">{completedCoverage} / {payload.coverageMatrix.length}</p>
                </div>
                <div className="rounded-lg border border-(--border)/40 p-3">
                  <p className="font-medium text-(--text)">Incident entries</p>
                  <p className="text-(--text)/70 mt-1">{payload.incidents.length}</p>
                </div>
                <div className="rounded-lg border border-(--border)/40 p-3">
                  <p className="font-medium text-(--text)">Fridge readings</p>
                  <p className="text-(--text)/70 mt-1">{payload.fridgeLogs.length}</p>
                </div>
                <div className="rounded-lg border border-(--border)/40 p-3">
                  <p className="font-medium text-(--text)">Fire alarm entries</p>
                  <p className="text-(--text)/70 mt-1">{payload.fireAlarmEntries.length}</p>
                </div>
              </div>
            </section>
          </>
        )}

        <div className="hidden md:flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setStep((previous) => Math.max(previous - 1, 0))}
            disabled={step === 0}
            className="rounded-full border border-(--border)/30 px-4 py-2.5 text-sm font-medium text-(--text) hover:bg-(--bg) transition disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
            )}
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((previous) => Math.min(previous + 1, STEP_TITLES.length - 1))}
                className="tl-btn px-4 py-2.5 text-sm"
              >
                Next Section
              </button>
            ) : (
              !isReadOnly && (
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={submitting}
                  className="tl-btn px-4 py-2.5 text-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Daily Report"}
                </button>
              )
            )}
          </div>
        </div>

        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-(--border)/40 bg-white/95 backdrop-blur px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep((previous) => Math.max(previous - 1, 0))}
              disabled={step === 0}
              className="flex-1 rounded-full border border-(--border)/30 px-3 py-2 text-sm font-medium text-(--text) disabled:opacity-50"
            >
              Previous
            </button>
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((previous) => Math.min(previous + 1, STEP_TITLES.length - 1))}
                className="tl-btn flex-1 px-3 py-2 text-sm"
              >
                Next
              </button>
            ) : (
              !isReadOnly && (
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={submitting}
                  className="tl-btn flex-1 px-3 py-2 text-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              )
            )}
          </div>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
              className="mt-2 w-full rounded-full border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
          )}
        </div>
      </div>

      {showDeleteDailyWarning && report && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
          onClick={() => {
            if (deletingReport) return;
            setShowDeleteDailyWarning(false);
            setDeleteConfirmInput("");
            setDeleteReportError("");
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-700">Delete Daily Report Warning</h3>
            <p className="mt-2 text-sm text-slate-700">
              This will permanently delete daily report <strong>{report.report_date}</strong> and its primary linked
              work order.
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Type <strong>{report.report_date}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteReportError) setDeleteReportError("");
              }}
              placeholder={`Type ${report.report_date}`}
              className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200"
              disabled={deletingReport}
            />
            {deleteReportError && <p className="mt-2 text-xs text-red-600">{deleteReportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingReport) return;
                  setShowDeleteDailyWarning(false);
                  setDeleteConfirmInput("");
                  setDeleteReportError("");
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={deletingReport}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDailyReport()}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deletingReport}
              >
                {deletingReport ? "Deleting..." : "Delete Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
