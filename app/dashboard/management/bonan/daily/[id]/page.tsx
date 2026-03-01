
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
  area: string | null;
  work_completed: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "emergency" | "high" | "normal" | "low";
  description: string;
  created_at: string;
}

interface AssociatedIncidentReport {
  id: string;
  bonan_report_id: string;
  report_number: string;
  report_date: string;
  section_key: string | null;
  section_name: string;
  incident_time: string | null;
  location: string | null;
  system_area: string | null;
  description: string;
  actions_taken: string | null;
  work_order_or_vendor: string | null;
  status: "open" | "in_progress" | "closed";
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
type ActionRecordType = "work-order" | "incident-report";

interface LocalDraftRecord {
  payload: DailyReportPayload;
  savedAt: string;
  serverUpdatedAt: string | null;
}

interface PendingSectionAction {
  sectionKey: string;
  sectionName: string;
  details?: string;
  actionType: ActionRecordType;
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

function SectionActionIconButton({
  onClick,
  disabled,
  title,
  linked = false,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  linked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-60",
        linked
          ? "border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
          : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
      )}
      aria-label={title}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6M9 16h4" />
      </svg>
    </button>
  );
}

function isIncidentEntryFilled(row: IncidentEntry): boolean {
  return Boolean(
    row.time.trim() ||
      row.systemArea.trim() ||
      row.description.trim() ||
      row.actionsTaken.trim() ||
      row.workOrderOrVendor.trim()
  );
}

function AreaStatusOptions() {
  return (
    <>
      <option value="O">OK</option>
      <option value="D">Deficiency</option>
      <option value="NA">NA</option>
    </>
  );
}

function YesNoOptions() {
  return (
    <>
      <option value="">Select</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </>
  );
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
  const [userRole, setUserRole] = useState<"admin" | "employee" | "client" | null>(null);
  const [associatedWorkOrders, setAssociatedWorkOrders] = useState<AssociatedWorkOrder[]>([]);
  const [associatedIncidentReports, setAssociatedIncidentReports] = useState<AssociatedIncidentReport[]>([]);
  const [creatingAssociatedWorkOrder, setCreatingAssociatedWorkOrder] = useState(false);
  const [creatingAssociatedIncidentReport, setCreatingAssociatedIncidentReport] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [showDeleteDailyWarning, setShowDeleteDailyWarning] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteReportError, setDeleteReportError] = useState("");
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncState, setSyncState] = useState<DraftSyncState>("idle");
  const [lastCachedAt, setLastCachedAt] = useState("");
  const [pendingSectionAction, setPendingSectionAction] = useState<PendingSectionAction | null>(null);

  const isReadOnly = report?.status === "submitted" || userRole === "client";
  const draftCacheKey = useMemo(() => getDraftCacheKey(id), [id]);
  const draftQueueKey = useMemo(() => getDraftQueueKey(id), [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedValue = window.localStorage.getItem("bonan-daily-header-collapsed");
    if (storedValue !== null) {
      setHeaderCollapsed(storedValue === "true");
      return;
    }

    if (window.matchMedia("(max-width: 767px)").matches) {
      setHeaderCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("bonan-daily-header-collapsed", String(headerCollapsed));
  }, [headerCollapsed]);

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
          const [associatedWorkOrdersRes, associatedIncidentReportsRes] = await Promise.all([
            fetch(`/api/bonan/reports/${id}/work-orders`),
            fetch(`/api/bonan/reports/${id}/incident-reports`),
          ]);
          const [associatedWorkOrdersData, associatedIncidentReportsData] = await Promise.all([
            associatedWorkOrdersRes.json(),
            associatedIncidentReportsRes.json(),
          ]);
          if (associatedWorkOrdersRes.ok) {
            setAssociatedWorkOrders(associatedWorkOrdersData.associatedWorkOrders || []);
          }
          if (associatedIncidentReportsRes.ok) {
            setAssociatedIncidentReports(associatedIncidentReportsData.associatedIncidentReports || []);
          }
        } catch (associatedError) {
          console.error("Failed to load associated records:", associatedError);
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
    }, 3000);

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

  function updateCriticalWaterStructuralChecks(
    updater: (
      current: DailyReportPayload["criticalWaterStructuralChecks"]
    ) => DailyReportPayload["criticalWaterStructuralChecks"]
  ) {
    updatePayload((current) => ({
      ...current,
      criticalWaterStructuralChecks: updater(current.criticalWaterStructuralChecks),
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

  async function refreshAssociatedIncidentReports() {
    try {
      const associatedRes = await fetch(`/api/bonan/reports/${id}/incident-reports`);
      const associatedData = await associatedRes.json();
      if (associatedRes.ok) {
        setAssociatedIncidentReports(associatedData.associatedIncidentReports || []);
      }
    } catch (fetchError) {
      console.error("Failed to refresh associated incident reports:", fetchError);
    }
  }

  function shortSectionLabel(label: string): string {
    const beforeColon = label.split(":")[0]?.trim();
    return beforeColon && beforeColon.length > 0 ? beforeColon : label;
  }

  function getLinkedSectionWorkOrder(
    sectionKey: string,
    fallbackSectionName?: string
  ): AssociatedWorkOrder | undefined {
    return associatedWorkOrders.find((workOrder) => {
      if (workOrder.area === sectionKey) return true;
      if (fallbackSectionName && workOrder.area === fallbackSectionName) return true;
      return false;
    });
  }

  function getLinkedSectionIncidentReport(
    sectionKey: string,
    fallbackSectionName?: string
  ): AssociatedIncidentReport | undefined {
    return associatedIncidentReports.find((incidentReport) => {
      if (incidentReport.section_key === sectionKey) return true;
      if (fallbackSectionName && incidentReport.section_name === fallbackSectionName) return true;
      return false;
    });
  }

  function isSectionLinked(
    sectionKey: string,
    sectionName?: string,
    type?: ActionRecordType
  ): boolean {
    if (!type) {
      return Boolean(
        getLinkedSectionWorkOrder(sectionKey, sectionName) ||
          getLinkedSectionIncidentReport(sectionKey, sectionName)
      );
    }
    if (type === "incident-report") {
      return Boolean(getLinkedSectionIncidentReport(sectionKey, sectionName));
    }
    return Boolean(getLinkedSectionWorkOrder(sectionKey, sectionName));
  }

  async function handleCreateAssociatedWorkOrder(options?: {
    sectionKey?: string;
    sectionName?: string;
    details?: string;
  }) {
    if (!report || creatingAssociatedWorkOrder) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You are offline. Reconnect to create a linked work order.");
      return;
    }

    const sectionKey = options?.sectionKey?.trim() || "";
    const sectionName = options?.sectionName?.trim() || "General Daily Walk-Through";
    const details = options?.details?.trim() || "";
    const descriptionPrefix = `${sectionName} - Daily Walk-Through`;
    const descriptionBody = details
      ? `${descriptionPrefix}. ${details}`
      : `${descriptionPrefix}. Deficiency follow-up recorded on ${report.report_date}.`;
    const linkedArea = sectionKey || sectionName;

    setCreatingAssociatedWorkOrder(true);
    setError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: descriptionBody,
          location: "Bonan Towers",
          area: linkedArea,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.existingAssociatedWorkOrder?.work_order_id) {
          setError(data.error || "A work order already exists for this section.");
          router.push(`/dashboard/management/work-orders/${data.existingAssociatedWorkOrder.work_order_id}`);
          return;
        }
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

  async function handleCreateAssociatedIncidentReport(options?: {
    sectionKey?: string;
    sectionName?: string;
    details?: string;
    incidentTime?: string;
    systemArea?: string;
    workOrderOrVendor?: string;
  }) {
    if (!report || creatingAssociatedIncidentReport) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You are offline. Reconnect to create a linked incident report.");
      return;
    }

    const sectionKey = options?.sectionKey?.trim() || "";
    const sectionName = options?.sectionName?.trim() || "General Daily Walk-Through";
    const details = options?.details?.trim() || "";
    const descriptionPrefix = `${sectionName} - Incident / Alarm Report`;
    const descriptionBody = details
      ? `${descriptionPrefix}. ${details}`
      : `${descriptionPrefix}. Incident observed during ${report.report_date} walkthrough.`;

    setCreatingAssociatedIncidentReport(true);
    setError("");
    try {
      const res = await fetch(`/api/bonan/reports/${id}/incident-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_key: sectionKey || undefined,
          section_name: sectionName,
          description: descriptionBody,
          incident_time: options?.incidentTime,
          location: "Bonan Towers",
          system_area: options?.systemArea,
          actions_taken: options?.details,
          work_order_or_vendor: options?.workOrderOrVendor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data?.existingAssociatedIncidentReport?.id) {
          setError(data.error || "An incident report already exists for this section.");
          router.push(`/dashboard/management/incident-reports/${data.existingAssociatedIncidentReport.id}`);
          return;
        }
        setError(data.error || "Failed to create associated incident report.");
        return;
      }

      await refreshAssociatedIncidentReports();
      router.push(`/dashboard/management/incident-reports/${data.associatedIncidentReport.id}`);
    } catch (createError) {
      console.error("Failed to create associated incident report:", createError);
      setError("Failed to create associated incident report.");
    } finally {
      setCreatingAssociatedIncidentReport(false);
    }
  }

  function handleSectionActionMenuOpen(options: {
    sectionKey: string;
    sectionName: string;
    details?: string;
  }) {
    setPendingSectionAction({
      sectionKey: options.sectionKey,
      sectionName: options.sectionName,
      details: options.details,
      actionType: "work-order",
    });
  }

  function confirmPendingSectionAction() {
    if (!pendingSectionAction) return;
    const request = pendingSectionAction;
    setPendingSectionAction(null);

    if (request.actionType === "incident-report") {
      const existingIncident = getLinkedSectionIncidentReport(request.sectionKey, request.sectionName);
      if (existingIncident) {
        router.push(`/dashboard/management/incident-reports/${existingIncident.id}`);
        return;
      }
      void handleCreateAssociatedIncidentReport({
        sectionKey: request.sectionKey,
        sectionName: request.sectionName,
        details: request.details,
      });
      return;
    }

    const existingWorkOrder = getLinkedSectionWorkOrder(request.sectionKey, request.sectionName);
    if (existingWorkOrder) {
      router.push(`/dashboard/management/work-orders/${existingWorkOrder.work_order_id}`);
      return;
    }
    void handleCreateAssociatedWorkOrder({
      sectionKey: request.sectionKey,
      sectionName: request.sectionName,
      details: request.details,
    });
  }

  function closePendingSectionActionPrompt() {
    if (creatingAssociatedWorkOrder || creatingAssociatedIncidentReport) return;
    setPendingSectionAction(null);
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
      (row) =>
        row.restroomsMale !== "NA" ||
        row.restroomsFemale !== "NA" ||
        row.fountain !== "NA" ||
        row.elecCloset !== "NA"
    ).length;
  }, [payload]);

  const reportedIncidentCount = useMemo(() => {
    if (!payload) return 0;
    return payload.incidents.filter((row) => isIncidentEntryFilled(row)).length;
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
    <div className="bonan-daily-editor min-h-screen bg-(--bg) overflow-x-hidden">
      <div className="w-full max-w-5xl mx-auto px-3 md:px-4 lg:px-6 py-4 pb-36 md:pb-6 space-y-4">

        {/* ── Top Bar ── */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/bonan/daily"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--border)/30 text-(--text)/70 hover:bg-(--bg) transition"
            aria-label="Back to Daily Reports"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-(--text) truncate">
                {report.report_date}
              </h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[report.status]}`}>
                {STATUS_LABELS[report.status]}
              </span>
              {report.work_order_number && (
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                  WO #{report.work_order_number}
                </span>
              )}
            </div>
            <p className="text-xs text-(--text)/50 mt-0.5">
              {isReadOnly
                ? `Submitted ${report.submitted_at ? formatUsCentralDateTime(report.submitted_at) + " CT" : ""}`
                : saveMessage || "Autosave active"}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            {report.work_order_id && (
              <Link
                href={`/dashboard/management/work-orders/${report.work_order_id}`}
                target="_blank"
                className="rounded-lg border border-(--border)/30 px-3 py-1.5 text-xs font-medium text-(--text)/70 hover:bg-(--bg) transition"
              >
                Linked WO
              </Link>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={saving}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 transition disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            )}
            {userRole === "admin" && (
              <button
                type="button"
                onClick={() => openDeleteDailyReportWarning()}
                disabled={deletingReport}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-60"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* ── Step Progress ── */}
        <nav className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm p-2">
          <div className="flex items-center gap-1">
            {STEP_TITLES.map((title, index) => (
              <button
                key={title}
                type="button"
                onClick={() => setStep(index)}
                className={classNames(
                  "flex-1 relative rounded-xl px-2 py-2 text-center transition-all",
                  step === index
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-(--text)/60 hover:bg-(--bg)"
                )}
              >
                <span className="block text-[11px] font-bold">{index + 1}</span>
                <span className="hidden sm:block text-[10px] font-medium leading-tight mt-0.5">{title}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* ── Sync / Error Banners ── */}
        {syncStatusText && (
          <div
            className={classNames(
              "rounded-xl px-3 py-2 text-xs font-medium",
              !isOnline
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : syncState === "syncing"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
            )}
          >
            {syncStatusText}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* ── Associated Work Orders ── */}
        <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-(--border)/10">
            <h2 className="text-sm font-semibold text-(--text)">Work Orders | Incident Reports</h2>
            <p className="text-[11px] text-(--text)/50 mt-0.5">Linked follow-up records for this daily walkthrough</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-(--border)/10">
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <h3 className="text-xs font-semibold text-(--text)">
                  Work Orders
                  {associatedWorkOrders.length > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-[10px] font-bold text-blue-700">
                      {associatedWorkOrders.length}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => void handleCreateAssociatedWorkOrder()}
                  disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {creatingAssociatedWorkOrder ? "Creating..." : "+ New WO"}
                </button>
              </div>
              {associatedWorkOrders.length === 0 ? (
                <p className="px-4 py-3 text-xs text-(--text)/50">
                  No work orders linked yet. Create one from any section.
                </p>
              ) : (
                <div className="divide-y divide-(--border)/10">
                  {associatedWorkOrders.map((associated) => (
                    <Link
                      key={associated.id}
                      href={`/dashboard/management/work-orders/${associated.work_order_id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-(--bg) transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-(--text)">WO #{associated.work_order_number}</p>
                        <p className="text-[11px] text-(--text)/50 mt-0.5 truncate">{associated.description}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className={classNames(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                          associated.work_completed === "completed" ? "bg-green-100 text-green-700"
                            : associated.work_completed === "in_progress" ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        )}>
                          {associated.work_completed.replace("_", " ")}
                        </span>
                        <svg className="h-3.5 w-3.5 text-(--text)/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <h3 className="text-xs font-semibold text-(--text)">
                  Incident Reports
                  {associatedIncidentReports.length > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">
                      {associatedIncidentReports.length}
                    </span>
                  )}
                </h3>
                <button
                  type="button"
                  onClick={() => void handleCreateAssociatedIncidentReport()}
                  disabled={creatingAssociatedIncidentReport || creatingAssociatedWorkOrder}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  {creatingAssociatedIncidentReport ? "Creating..." : "+ New IR"}
                </button>
              </div>
              {associatedIncidentReports.length === 0 ? (
                <p className="px-4 py-3 text-xs text-(--text)/50">
                  No incident reports linked yet. Create one from any section.
                </p>
              ) : (
                <div className="divide-y divide-(--border)/10">
                  {associatedIncidentReports.map((associated) => (
                    <Link
                      key={associated.id}
                      href={`/dashboard/management/incident-reports/${associated.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-(--bg) transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-(--text)">{associated.report_number}</p>
                        <p className="text-[11px] text-(--text)/50 mt-0.5 truncate">{associated.description}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span
                          className={classNames(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                            associated.status === "closed"
                              ? "bg-green-100 text-green-700"
                              : associated.status === "in_progress"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {associated.status.replace("_", " ")}
                        </span>
                        <svg className="h-3.5 w-3.5 text-(--text)/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Header Fields ── */}
        <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setHeaderCollapsed((previous) => !previous)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-(--bg)/50 transition"
            aria-expanded={!headerCollapsed}
            aria-controls="daily-form-header-fields"
          >
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-(--text)">Report Details</h2>
              {headerCollapsed && (
                <p className="text-[11px] text-(--text)/50 mt-0.5 truncate">
                  {payload.metadata.date || "No date"} &middot; {payload.metadata.inspector || "No inspector"} &middot; {payload.metadata.shift || "No shift"}
                </p>
              )}
            </div>
            <svg
              className={classNames("h-4 w-4 shrink-0 text-(--text)/40 transition-transform", headerCollapsed ? "" : "rotate-180")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {!headerCollapsed && (
            <div id="daily-form-header-fields" className="border-t border-(--border)/10 px-4 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Date</span>
                  <input
                    type="date"
                    value={payload.metadata.date}
                    onChange={(event) => updateMetadata("date", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Start</span>
                  <input
                    type="time"
                    value={payload.metadata.start}
                    onChange={(event) => updateMetadata("start", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">End</span>
                  <input
                    type="time"
                    value={payload.metadata.end}
                    onChange={(event) => updateMetadata("end", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Inspector</span>
                  <input
                    type="text"
                    value={payload.metadata.inspector}
                    onChange={(event) => updateMetadata("inspector", event.target.value)}
                    disabled={isReadOnly}
                    placeholder="Name"
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Towers</span>
                  <select
                    value={payload.metadata.towers}
                    onChange={(event) => updateMetadata("towers", event.target.value as DailyReportPayload["metadata"]["towers"])}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  >
                    <option value="north">North</option>
                    <option value="south">South</option>
                    <option value="both">Both</option>
                  </select>
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Weather</span>
                  <input
                    type="text"
                    value={payload.metadata.weather}
                    onChange={(event) => updateMetadata("weather", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Shift</span>
                  <input
                    type="text"
                    value={payload.metadata.shift}
                    onChange={(event) => updateMetadata("shift", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Supervisor</span>
                  <input
                    type="text"
                    value={payload.metadata.supervisorReview}
                    onChange={(event) => updateMetadata("supervisorReview", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full min-w-0 rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Work Orders Created (WO#)</span>
                  <input
                    type="text"
                    value={payload.metadata.workOrdersCreated}
                    onChange={(event) => updateMetadata("workOrdersCreated", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Signature (typed)</span>
                  <input
                    type="text"
                    value={payload.metadata.signature}
                    onChange={(event) => updateMetadata("signature", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
              </div>
            </div>
          )}
        </section>

        {step === 0 && (
          <>
            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">Coverage Matrix</h2>
                  <p className="text-[11px] text-(--text)/50 mt-0.5">Mark each area: OK, Deficiency, or NA</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-(--text)/60">
                  {completedCoverage}/{payload.coverageMatrix.length}
                </span>
              </div>
              <div className="xl:hidden divide-y divide-(--border)/10">
                {payload.coverageMatrix.map((row, index) => (
                  <div key={row.area} className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-(--text)">{row.area}</p>
                      <SectionActionIconButton
                        onClick={() =>
                          handleSectionActionMenuOpen({
                            sectionKey: `coverage:${row.area}`,
                            sectionName: row.area,
                            details: row.notes || "Coverage matrix deficiency follow-up.",
                          })
                        }
                        disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                        linked={isSectionLinked(`coverage:${row.area}`)}
                        title={
                          isSectionLinked(`coverage:${row.area}`)
                            ? `Open linked record for ${row.area}`
                            : `Create follow-up record for ${row.area}`
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Male</span>
                        <select
                          value={row.restroomsMale}
                          onChange={(event) =>
                            updateCoverageRow(index, "restroomsMale", event.target.value as CoverageMatrixRow["restroomsMale"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        >
                          <AreaStatusOptions />
                        </select>
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Female</span>
                        <select
                          value={row.restroomsFemale}
                          onChange={(event) =>
                            updateCoverageRow(index, "restroomsFemale", event.target.value as CoverageMatrixRow["restroomsFemale"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        >
                          <AreaStatusOptions />
                        </select>
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Fountain</span>
                        <select
                          value={row.fountain}
                          onChange={(event) =>
                            updateCoverageRow(index, "fountain", event.target.value as CoverageMatrixRow["fountain"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        >
                          <AreaStatusOptions />
                        </select>
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Elec</span>
                        <select
                          value={row.elecCloset}
                          onChange={(event) =>
                            updateCoverageRow(index, "elecCloset", event.target.value as CoverageMatrixRow["elecCloset"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        >
                          <AreaStatusOptions />
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="sm:col-span-2 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Notes</span>
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(event) => updateCoverageRow(index, "notes", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                      <label className="space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Initials</span>
                        <input
                          type="text"
                          value={row.initials}
                          onChange={(event) => updateCoverageRow(index, "initials", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-(--text)/70 text-xs">
                    <tr>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Area</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Male</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Female</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Fountain</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Elec Closet</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Notes / WO#</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Initials</th>
                      <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-12">WO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border)/10">
                    {payload.coverageMatrix.map((row, index) => (
                      <tr key={row.area} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-sm text-(--text)">{row.area}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.restroomsMale}
                            onChange={(event) =>
                              updateCoverageRow(index, "restroomsMale", event.target.value as CoverageMatrixRow["restroomsMale"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          >
                            <AreaStatusOptions />
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.restroomsFemale}
                            onChange={(event) =>
                              updateCoverageRow(index, "restroomsFemale", event.target.value as CoverageMatrixRow["restroomsFemale"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          >
                            <AreaStatusOptions />
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.fountain}
                            onChange={(event) =>
                              updateCoverageRow(index, "fountain", event.target.value as CoverageMatrixRow["fountain"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          >
                            <AreaStatusOptions />
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.elecCloset}
                            onChange={(event) =>
                              updateCoverageRow(index, "elecCloset", event.target.value as CoverageMatrixRow["elecCloset"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          >
                            <AreaStatusOptions />
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(event) => updateCoverageRow(index, "notes", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.initials}
                            onChange={(event) => updateCoverageRow(index, "initials", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <SectionActionIconButton
                            onClick={() =>
                              handleSectionActionMenuOpen({
                                sectionKey: `coverage:${row.area}`,
                                sectionName: row.area,
                                details: row.notes || "Coverage matrix deficiency follow-up.",
                              })
                            }
                            disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                            linked={isSectionLinked(`coverage:${row.area}`)}
                            title={
                              isSectionLinked(`coverage:${row.area}`)
                                ? `Open linked record for ${row.area}`
                                : `Create follow-up record for ${row.area}`
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-(--border)/10">
                <h2 className="text-sm font-semibold text-(--text)">Atrium & Common Areas</h2>
              </div>
              <div className="divide-y divide-(--border)/10">
                {payload.commonAreas.map((item, index) => (
                  <div key={item.label} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(event) => updateChecklistRow("commonAreas", index, { checked: event.target.checked })}
                          disabled={isReadOnly}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-(--border)/40 accent-blue-600"
                        />
                        <span className="text-xs font-medium text-(--text) leading-relaxed">{item.label}</span>
                      </label>
                      <SectionActionIconButton
                        onClick={() =>
                          handleSectionActionMenuOpen({
                            sectionKey: `common:${index}`,
                            sectionName: shortSectionLabel(item.label),
                            details: item.notes || item.label,
                          })
                        }
                        disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                        linked={isSectionLinked(`common:${index}`)}
                        title={
                          isSectionLinked(`common:${index}`)
                            ? `Open linked record for ${shortSectionLabel(item.label)}`
                            : `Create follow-up record for ${shortSectionLabel(item.label)}`
                        }
                      />
                    </div>
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateChecklistRow("commonAreas", index, { notes: event.target.value })}
                      disabled={isReadOnly}
                      rows={1}
                      placeholder="Notes"
                      className="w-full rounded-lg border border-(--border)/30 bg-(--bg) px-3 py-2 text-xs text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {step === 1 && (
          <>
            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">Critical Systems & Life Safety</h2>
                  <p className="text-[11px] text-(--text)/50 mt-0.5">Temperature readings</p>
                </div>
                <SectionActionIconButton
                  onClick={() =>
                    handleSectionActionMenuOpen({
                      sectionKey: "critical-systems",
                      sectionName: "Critical Systems & Life Safety",
                      details:
                        `Pump Room: ${payload.temperatures.pumpRoom || "n/a"}, Boiler Room: ${payload.temperatures.boilerRoom || "n/a"}, ` +
                        `Atrium: ${payload.temperatures.atrium || "n/a"}.`,
                    })
                  }
                  disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                  linked={isSectionLinked("critical-systems")}
                  title={
                    isSectionLinked("critical-systems")
                      ? "Open linked record for Critical Systems & Life Safety"
                      : "Create follow-up record for Critical Systems & Life Safety"
                  }
                />
              </div>
              <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Pump Room (F)</span>
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
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Boiler Room (F)</span>
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
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Atrium (F)</span>
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
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) text-center font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">Critical Water & Structural Checks</h2>
                  <p className="text-[11px] text-(--text)/50 mt-0.5">Main shutoff, sprinkler room, boiler room, and pump room checks</p>
                </div>
                <SectionActionIconButton
                  onClick={() =>
                    handleSectionActionMenuOpen({
                      sectionKey: "critical-water-structural",
                      sectionName: "Critical Water & Structural Checks",
                      details:
                        `Main shutoff: ${payload.criticalWaterStructuralChecks.buildingMainShutoff.locationFound || "n/a"}, ` +
                        `Pump sprinkler temp: ${payload.criticalWaterStructuralChecks.pumpSprinklerRoom.roomTemperature || "n/a"}, ` +
                        `Boiler 1 function: ${payload.criticalWaterStructuralChecks.boilerRoom.boiler1.functioning || "n/a"}`,
                    })
                  }
                  disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                  linked={isSectionLinked("critical-water-structural")}
                  title={
                    isSectionLinked("critical-water-structural")
                      ? "Open linked record for Critical Water & Structural Checks"
                      : "Create follow-up record for Critical Water & Structural Checks"
                  }
                />
              </div>

              <div className="space-y-4 px-4 py-4">
                <div className="rounded-xl border border-(--border)/20 bg-white p-3">
                  <h3 className="text-xs font-semibold text-(--text)">Building Main Shutoff</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-5 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Location Found</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.buildingMainShutoff.locationFound}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            buildingMainShutoff: { ...checks.buildingMainShutoff, locationFound: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <YesNoOptions />
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Valve Condition</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.buildingMainShutoff.valveCondition}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            buildingMainShutoff: { ...checks.buildingMainShutoff, valveCondition: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <option value="">Select</option>
                        <option value="Check">Check</option>
                        <option value="X">X</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Accessible</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.buildingMainShutoff.accessible}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            buildingMainShutoff: { ...checks.buildingMainShutoff, accessible: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <YesNoOptions />
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Signage Intact</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.buildingMainShutoff.signageIntact}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            buildingMainShutoff: { ...checks.buildingMainShutoff, signageIntact: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <YesNoOptions />
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Leaks</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.buildingMainShutoff.leaks}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            buildingMainShutoff: { ...checks.buildingMainShutoff, leaks: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <YesNoOptions />
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-(--border)/20 bg-white p-3">
                  <h3 className="text-xs font-semibold text-(--text)">Pump Sprinkler Room</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Room Temperature</span>
                      <input
                        value={payload.criticalWaterStructuralChecks.pumpSprinklerRoom.roomTemperature}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            pumpSprinklerRoom: { ...checks.pumpSprinklerRoom, roomTemperature: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Pump Motor Drain Clogged</span>
                      <select
                        value={payload.criticalWaterStructuralChecks.pumpSprinklerRoom.pumpMotorDrainClogged}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            pumpSprinklerRoom: { ...checks.pumpSprinklerRoom, pumpMotorDrainClogged: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      >
                        <YesNoOptions />
                      </select>
                    </label>
                    <label className="space-y-1 text-xs md:col-span-3">
                      <span className="font-medium text-(--text)/60">Sprinkler Pump Room Notes</span>
                      <textarea
                        rows={2}
                        value={payload.criticalWaterStructuralChecks.pumpSprinklerRoom.notes}
                        onChange={(event) =>
                          updateCriticalWaterStructuralChecks((checks) => ({
                            ...checks,
                            pumpSprinklerRoom: { ...checks.pumpSprinklerRoom, notes: event.target.value },
                          }))
                        }
                        disabled={isReadOnly}
                        className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-(--border)/20 bg-white p-3">
                  <h3 className="text-xs font-semibold text-(--text)">Boiler Room</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {([
                      { key: "boiler1", label: "Boiler 1" },
                      { key: "boiler2", label: "Boiler 2" },
                    ] as const).map((boiler) => (
                      <div key={boiler.key} className="rounded-lg border border-(--border)/20 p-2">
                        <p className="text-[11px] font-semibold text-(--text)">{boiler.label}</p>
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label className="space-y-1 text-xs">
                            <span className="font-medium text-(--text)/60">Function</span>
                            <select
                              value={payload.criticalWaterStructuralChecks.boilerRoom[boiler.key].functioning}
                              onChange={(event) =>
                                updateCriticalWaterStructuralChecks((checks) => ({
                                  ...checks,
                                  boilerRoom: {
                                    ...checks.boilerRoom,
                                    [boiler.key]: {
                                      ...checks.boilerRoom[boiler.key],
                                      functioning: event.target.value,
                                    },
                                  },
                                }))
                              }
                              disabled={isReadOnly}
                              className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                            >
                              <YesNoOptions />
                            </select>
                          </label>
                          <label className="space-y-1 text-xs">
                            <span className="font-medium text-(--text)/60">Load %</span>
                            <input
                              value={payload.criticalWaterStructuralChecks.boilerRoom[boiler.key].loadPercent}
                              onChange={(event) =>
                                updateCriticalWaterStructuralChecks((checks) => ({
                                  ...checks,
                                  boilerRoom: {
                                    ...checks.boilerRoom,
                                    [boiler.key]: {
                                      ...checks.boilerRoom[boiler.key],
                                      loadPercent: event.target.value,
                                    },
                                  },
                                }))
                              }
                              disabled={isReadOnly}
                              className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                            />
                          </label>
                          <label className="space-y-1 text-xs col-span-2">
                            <span className="font-medium text-(--text)/60">SH1 / SH2 / SH3 / DHW Temps</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                              {(["sh1Temp", "sh2Temp", "sh3Temp", "dhwTemp"] as const).map((field) => (
                                <input
                                  key={`${boiler.key}-${field}`}
                                  value={payload.criticalWaterStructuralChecks.boilerRoom[boiler.key][field]}
                                  onChange={(event) =>
                                    updateCriticalWaterStructuralChecks((checks) => ({
                                      ...checks,
                                      boilerRoom: {
                                        ...checks.boilerRoom,
                                        [boiler.key]: {
                                          ...checks.boilerRoom[boiler.key],
                                          [field]: event.target.value,
                                        },
                                      },
                                    }))
                                  }
                                  disabled={isReadOnly}
                                  placeholder={field === "dhwTemp" ? "DHW" : field.replace("Temp", "").toUpperCase()}
                                  className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"
                                />
                              ))}
                            </div>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Gauge Left Suction PSI</span>
                      <input value={payload.criticalWaterStructuralChecks.boilerRoom.gaugeLeftSuctionPsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, gaugeLeftSuctionPsi: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Gauge Right Discharge PSI</span>
                      <input value={payload.criticalWaterStructuralChecks.boilerRoom.gaugeRightDischargePsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, gaugeRightDischargePsi: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Pump 1 Suction / Discharge PSI</span>
                      <div className="grid grid-cols-2 gap-1">
                        <input value={payload.criticalWaterStructuralChecks.boilerRoom.pump1SuctionPsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, pump1SuctionPsi: event.target.value } }))} disabled={isReadOnly} placeholder="Suction" className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                        <input value={payload.criticalWaterStructuralChecks.boilerRoom.pump1DischargePsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, pump1DischargePsi: event.target.value } }))} disabled={isReadOnly} placeholder="Discharge" className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                      </div>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Pump 2 Suction / Discharge PSI</span>
                      <div className="grid grid-cols-2 gap-1">
                        <input value={payload.criticalWaterStructuralChecks.boilerRoom.pump2SuctionPsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, pump2SuctionPsi: event.target.value } }))} disabled={isReadOnly} placeholder="Suction" className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                        <input value={payload.criticalWaterStructuralChecks.boilerRoom.pump2DischargePsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, pump2DischargePsi: event.target.value } }))} disabled={isReadOnly} placeholder="Discharge" className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                      </div>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Air Compressor PSI</span>
                      <input value={payload.criticalWaterStructuralChecks.boilerRoom.airCompressorPsi} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, airCompressorPsi: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Floor Drain Clear</span>
                      <select value={payload.criticalWaterStructuralChecks.boilerRoom.floorDrainClear} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, floorDrainClear: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"><YesNoOptions /></select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Music</span>
                      <select value={payload.criticalWaterStructuralChecks.boilerRoom.musicStatus} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, boilerRoom: { ...checks.boilerRoom, musicStatus: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50">
                        <option value="">Select</option>
                        <option value="On">On</option>
                        <option value="Off">Off</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-(--border)/20 bg-white p-3">
                  <h3 className="text-xs font-semibold text-(--text)">Pump Room</h3>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">No Visible Water Accumulation</span>
                      <select value={payload.criticalWaterStructuralChecks.pumpRoom.noVisibleWaterAccumulation} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, pumpRoom: { ...checks.pumpRoom, noVisibleWaterAccumulation: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50"><YesNoOptions /></select>
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Pressure Reading 1</span>
                      <input value={payload.criticalWaterStructuralChecks.pumpRoom.pressureReading1} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, pumpRoom: { ...checks.pumpRoom, pressureReading1: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Pressure Reading 2</span>
                      <input value={payload.criticalWaterStructuralChecks.pumpRoom.pressureReading2} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, pumpRoom: { ...checks.pumpRoom, pressureReading2: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium text-(--text)/60">Domestic Water Lines</span>
                      <input value={payload.criticalWaterStructuralChecks.pumpRoom.domesticWaterLines} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, pumpRoom: { ...checks.pumpRoom, domesticWaterLines: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                    <label className="space-y-1 text-xs md:col-span-4">
                      <span className="font-medium text-(--text)/60">Notes</span>
                      <textarea rows={2} value={payload.criticalWaterStructuralChecks.pumpRoom.notes} onChange={(event) => updateCriticalWaterStructuralChecks((checks) => ({ ...checks, pumpRoom: { ...checks.pumpRoom, notes: event.target.value } }))} disabled={isReadOnly} className="w-full rounded border border-(--border)/35 bg-white px-2 py-1.5 text-xs disabled:bg-slate-50" />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-(--border)/10">
                <h2 className="text-sm font-semibold text-(--text)">Risk Controls</h2>
                <p className="text-[11px] text-(--text)/50 mt-0.5">Insurance review checklist</p>
              </div>
              <div className="divide-y divide-(--border)/10">
                {payload.riskControls.map((item, index) => (
                  <div key={item.label} className="px-4 py-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(event) => updateChecklistRow("riskControls", index, { checked: event.target.checked })}
                          disabled={isReadOnly}
                          className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-(--border)/40 accent-blue-600"
                        />
                        <span className="text-xs font-medium text-(--text) leading-relaxed">{item.label}</span>
                      </label>
                      <SectionActionIconButton
                        onClick={() =>
                          handleSectionActionMenuOpen({
                            sectionKey: `risk:${index}`,
                            sectionName: shortSectionLabel(item.label),
                            details: item.notes || item.label,
                          })
                        }
                        disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                        linked={isSectionLinked(`risk:${index}`)}
                        title={
                          isSectionLinked(`risk:${index}`)
                            ? `Open linked record for ${shortSectionLabel(item.label)}`
                            : `Create follow-up record for ${shortSectionLabel(item.label)}`
                        }
                      />
                    </div>
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateChecklistRow("riskControls", index, { notes: event.target.value })}
                      disabled={isReadOnly}
                      rows={1}
                      placeholder="Notes"
                      className="w-full rounded-lg border border-(--border)/30 bg-(--bg) px-3 py-2 text-xs text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">Incidents / Alarms / Shutdowns</h2>
                  <p className="text-[11px] text-(--text)/50 mt-0.5">Include WO# or vendor ref where possible</p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addIncidentRow}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-(--text)/70 hover:bg-slate-200 transition"
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="xl:hidden divide-y divide-(--border)/10">
                {payload.incidents.map((row, index) => (
                  <div key={`${index}-${row.time}-${row.systemArea}`} className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-(--text)/50 uppercase tracking-wider">Incident {index + 1}</p>
                      <div className="flex items-center gap-1.5">
                        <SectionActionIconButton
                          onClick={() =>
                            handleSectionActionMenuOpen({
                              sectionKey: `incident:${index}`,
                              sectionName: row.systemArea || `Incident Row ${index + 1}`,
                              details: row.description || row.actionsTaken || "Incident follow-up required.",
                            })
                          }
                          disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                          linked={isSectionLinked(`incident:${index}`)}
                          title={
                            isSectionLinked(`incident:${index}`)
                              ? `Open linked record for incident row ${index + 1}`
                              : `Create follow-up record for incident row ${index + 1}`
                          }
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeIncidentRow(index)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition"
                            aria-label="Remove incident"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Time</span>
                        <input
                          type="text"
                          value={row.time}
                          onChange={(event) => updateIncidentRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">System / Area</span>
                        <input
                          type="text"
                          value={row.systemArea}
                          onChange={(event) => updateIncidentRow(index, "systemArea", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                    </div>
                    <label className="space-y-0.5 text-[10px] block">
                      <span className="text-(--text)/50 font-medium">Description</span>
                      <textarea
                        value={row.description}
                        onChange={(event) => updateIncidentRow(index, "description", event.target.value)}
                        disabled={isReadOnly}
                        rows={2}
                        className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                      />
                    </label>
                    <label className="space-y-0.5 text-[10px] block">
                      <span className="text-(--text)/50 font-medium">Actions Taken</span>
                      <textarea
                        value={row.actionsTaken}
                        onChange={(event) => updateIncidentRow(index, "actionsTaken", event.target.value)}
                        disabled={isReadOnly}
                        rows={2}
                        className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                      />
                    </label>
                    <label className="space-y-0.5 text-[10px] block">
                      <span className="text-(--text)/50 font-medium">WO# / Vendor</span>
                      <input
                        type="text"
                        value={row.workOrderOrVendor}
                        onChange={(event) => updateIncidentRow(index, "workOrderOrVendor", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                      />
                    </label>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-(--text)/70 text-xs">
                    <tr>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Time</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">System / Area</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Description</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Actions Taken</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">WO# / Vendor</th>
                      <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-12">WO</th>
                      {!isReadOnly && <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-16">Remove</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border)/10">
                    {payload.incidents.map((row, index) => (
                      <tr key={`${index}-${row.time}-${row.systemArea}`} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.time}
                            onChange={(event) => updateIncidentRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.systemArea}
                            onChange={(event) => updateIncidentRow(index, "systemArea", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={row.description}
                            onChange={(event) => updateIncidentRow(index, "description", event.target.value)}
                            disabled={isReadOnly}
                            rows={2}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            value={row.actionsTaken}
                            onChange={(event) => updateIncidentRow(index, "actionsTaken", event.target.value)}
                            disabled={isReadOnly}
                            rows={2}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.workOrderOrVendor}
                            onChange={(event) => updateIncidentRow(index, "workOrderOrVendor", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <SectionActionIconButton
                            onClick={() =>
                              handleSectionActionMenuOpen({
                                sectionKey: `incident:${index}`,
                                sectionName: row.systemArea || `Incident Row ${index + 1}`,
                                details: row.description || row.actionsTaken || "Incident follow-up required.",
                              })
                            }
                            disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                            linked={isSectionLinked(`incident:${index}`)}
                            title={
                              isSectionLinked(`incident:${index}`)
                                ? `Open linked record for incident row ${index + 1}`
                                : `Create follow-up record for incident row ${index + 1}`
                            }
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeIncidentRow(index)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
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
              <div className="border-t border-(--border)/10 px-4 py-3">
                <label className="space-y-1 text-xs block">
                  <span className="font-medium text-(--text)/60">Documentation Reference</span>
                  <textarea
                    value={payload.incidentDocumentationReference}
                    onChange={(event) =>
                      updatePayload((current) => ({
                        ...current,
                        incidentDocumentationReference: event.target.value,
                      }))
                    }
                    disabled={isReadOnly}
                    rows={2}
                    className="w-full rounded-lg border border-(--border)/30 bg-(--bg) px-3 py-2 text-xs text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-(--border)/10">
                <div>
                  <h2 className="text-sm font-semibold text-(--text)">Fridge Temperature Log</h2>
                  <p className="text-[11px] text-(--text)/50 mt-0.5">Target: 34-41F</p>
                </div>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addFridgeRow}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-(--text)/70 hover:bg-slate-200 transition"
                  >
                    + Add
                  </button>
                )}
              </div>
              <div className="xl:hidden divide-y divide-(--border)/10">
                {payload.fridgeLogs.map((row, index) => (
                  <div key={`${index}-${row.date}-${row.time}`} className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-(--text)/50 uppercase tracking-wider">Reading {index + 1}</p>
                      <div className="flex items-center gap-1.5">
                        <SectionActionIconButton
                          onClick={() =>
                            handleSectionActionMenuOpen({
                              sectionKey: `fridge:${index}`,
                              sectionName: "Retail Fridge",
                              details:
                                `Entry ${index + 1}: Temp ${row.tempF || "n/a"}F at ${row.time || "n/a"}, within target ${row.withinTarget}. ` +
                                `${row.correctiveAction || "Follow-up required."}`,
                            })
                          }
                          disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                          linked={isSectionLinked(`fridge:${index}`)}
                          title={
                            isSectionLinked(`fridge:${index}`)
                              ? `Open linked record for fridge entry ${index + 1}`
                              : `Create follow-up record for fridge entry ${index + 1}`
                          }
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeFridgeRow(index)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition"
                            aria-label="Remove reading"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Date</span>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateFridgeRow(index, "date", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Time</span>
                        <input
                          type="time"
                          value={row.time}
                          onChange={(event) => updateFridgeRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Temp (F)</span>
                        <input
                          type="text"
                          value={row.tempF}
                          onChange={(event) => updateFridgeRow(index, "tempF", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white text-center font-semibold disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">In Range?</span>
                        <select
                          value={row.withinTarget}
                          onChange={(event) =>
                            updateFridgeRow(index, "withinTarget", event.target.value as FridgeTempEntry["withinTarget"])
                          }
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        >
                          <option value="Y">Y</option>
                          <option value="N">N</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="sm:col-span-2 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Corrective Action</span>
                        <input
                          type="text"
                          value={row.correctiveAction}
                          onChange={(event) => updateFridgeRow(index, "correctiveAction", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                      <label className="space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Initials</span>
                        <input
                          type="text"
                          value={row.initials}
                          onChange={(event) => updateFridgeRow(index, "initials", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs text-(--text) bg-white disabled:opacity-60"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-(--text)/70 text-xs">
                    <tr>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Date</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Time</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Temp (F)</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">In Range?</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Corrective Action</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Initials</th>
                      <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-12">WO</th>
                      {!isReadOnly && <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-16">Remove</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border)/10">
                    {payload.fridgeLogs.map((row, index) => (
                      <tr key={`${index}-${row.date}-${row.time}`} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(event) => updateFridgeRow(index, "date", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="time"
                            value={row.time}
                            onChange={(event) => updateFridgeRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.tempF}
                            onChange={(event) => updateFridgeRow(index, "tempF", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.withinTarget}
                            onChange={(event) =>
                              updateFridgeRow(index, "withinTarget", event.target.value as FridgeTempEntry["withinTarget"])
                            }
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          >
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.correctiveAction}
                            onChange={(event) => updateFridgeRow(index, "correctiveAction", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.initials}
                            onChange={(event) => updateFridgeRow(index, "initials", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 text-sm text-(--text) bg-white disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <SectionActionIconButton
                            onClick={() =>
                              handleSectionActionMenuOpen({
                                sectionKey: `fridge:${index}`,
                                sectionName: "Retail Fridge",
                                details:
                                  `Entry ${index + 1}: Temp ${row.tempF || "n/a"}F at ${row.time || "n/a"}, within target ${row.withinTarget}. ` +
                                  `${row.correctiveAction || "Follow-up required."}`,
                              })
                            }
                            disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                            linked={isSectionLinked(`fridge:${index}`)}
                            title={
                              isSectionLinked(`fridge:${index}`)
                                ? `Open linked record for fridge entry ${index + 1}`
                                : `Create follow-up record for fridge entry ${index + 1}`
                            }
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFridgeRow(index)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
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
            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-(--border)/10">
                <h2 className="text-sm font-semibold text-(--text)">Fire Alarm Panel Status</h2>
                <p className="text-[11px] text-(--text)/50 mt-0.5">Main (Sprinkler Pump Room) & Sub-Panel (Boiler Room)</p>
              </div>
              <div className="px-4 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Date Range</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.dateRange}
                    onChange={(event) => updateFireAlarmMeta("dateRange", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Prepared By</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.preparedBy}
                    onChange={(event) => updateFireAlarmMeta("preparedBy", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Supervisor</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.supervisorReview}
                    onChange={(event) => updateFireAlarmMeta("supervisorReview", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs">
                  <span className="font-medium text-(--text)/60">Signature</span>
                  <input
                    type="text"
                    value={payload.fireAlarmMeta.signature}
                    onChange={(event) => updateFireAlarmMeta("signature", event.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-(--border)/40 bg-(--bg) px-3 py-2.5 text-sm text-(--text) focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-(--border)/10 bg-slate-50/50">
                <h3 className="text-xs font-semibold text-(--text)/70">Event Log</h3>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={addFireAlarmRow}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-(--text)/70 hover:bg-slate-200 transition"
                  >
                    + Add Entry
                  </button>
                )}
              </div>

              <div className="xl:hidden divide-y divide-(--border)/10">
                {payload.fireAlarmEntries.map((row, index) => (
                  <div key={`${index}-${row.date}-${row.time}`} className="px-3 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold text-(--text)/50 uppercase tracking-wider">Entry {index + 1}</p>
                      <div className="flex items-center gap-1.5">
                        <SectionActionIconButton
                          onClick={() =>
                            handleSectionActionMenuOpen({
                              sectionKey: `fire-alarm:${index}`,
                              sectionName: row.panel ? `Fire Alarm - ${row.panel}` : "Fire Alarm",
                              details:
                                `${row.type || "Event"} ${row.messageZone || ""} ${row.actionTaken || ""}`.trim() ||
                                "Fire alarm event follow-up required.",
                            })
                          }
                          disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                          linked={isSectionLinked(`fire-alarm:${index}`)}
                          title={
                            isSectionLinked(`fire-alarm:${index}`)
                              ? `Open linked record for fire alarm entry ${index + 1}`
                              : `Create follow-up record for fire alarm entry ${index + 1}`
                          }
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeFireAlarmRow(index)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition"
                            aria-label="Remove entry"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Date</span>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateFireAlarmRow(index, "date", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Time</span>
                        <input
                          type="time"
                          value={row.time}
                          onChange={(event) => updateFireAlarmRow(index, "time", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Panel</span>
                        <input
                          type="text"
                          value={row.panel}
                          onChange={(event) => updateFireAlarmRow(index, "panel", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                        />
                      </label>
                      <label className="min-w-0 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">Type</span>
                        <input
                          type="text"
                          value={row.type}
                          onChange={(event) => updateFireAlarmRow(index, "type", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-1.5 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                        />
                      </label>
                    </div>
                    <label className="space-y-0.5 text-[10px] block">
                      <span className="text-(--text)/50 font-medium">Message / Zone</span>
                      <input
                        type="text"
                        value={row.messageZone}
                        onChange={(event) => updateFireAlarmRow(index, "messageZone", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                      />
                    </label>
                    <label className="space-y-0.5 text-[10px] block">
                      <span className="text-(--text)/50 font-medium">Action Taken</span>
                      <input
                        type="text"
                        value={row.actionTaken}
                        onChange={(event) => updateFireAlarmRow(index, "actionTaken", event.target.value)}
                        disabled={isReadOnly}
                        className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                      />
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex-1 space-y-0.5 text-[10px]">
                        <span className="text-(--text)/50 font-medium">WO#</span>
                        <input
                          type="text"
                          value={row.workOrderNumber}
                          onChange={(event) => updateFireAlarmRow(index, "workOrderNumber", event.target.value)}
                          disabled={isReadOnly}
                          className="w-full rounded-lg border border-(--border)/30 px-2 py-2 text-xs bg-white text-(--text) disabled:opacity-60"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-(--text) pt-3.5">
                        <input
                          type="checkbox"
                          checked={row.cleared}
                          onChange={(event) => updateFireAlarmRow(index, "cleared", event.target.checked)}
                          disabled={isReadOnly}
                          className="h-5 w-5 rounded-md border-(--border)/40 accent-blue-600"
                        />
                        Cleared
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden xl:block overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-(--text)/70 text-xs">
                    <tr>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Date</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Time</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Panel</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Type</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Message / Zone</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">Action Taken</th>
                      <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold">Cleared</th>
                      <th className="border-b border-(--border)/20 px-3 py-2.5 text-left font-semibold">WO#</th>
                      <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-12">WO</th>
                      {!isReadOnly && <th className="border-b border-(--border)/20 px-2 py-2.5 text-center font-semibold w-16">Remove</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--border)/10">
                    {payload.fireAlarmEntries.map((row, index) => (
                      <tr key={`${index}-${row.date}-${row.time}`} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(event) => updateFireAlarmRow(index, "date", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="time"
                            value={row.time}
                            onChange={(event) => updateFireAlarmRow(index, "time", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.panel}
                            onChange={(event) => updateFireAlarmRow(index, "panel", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.type}
                            onChange={(event) => updateFireAlarmRow(index, "type", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.messageZone}
                            onChange={(event) => updateFireAlarmRow(index, "messageZone", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.actionTaken}
                            onChange={(event) => updateFireAlarmRow(index, "actionTaken", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.cleared}
                            onChange={(event) => updateFireAlarmRow(index, "cleared", event.target.checked)}
                            disabled={isReadOnly}
                            className="h-5 w-5 rounded-md border-(--border)/40 accent-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.workOrderNumber}
                            onChange={(event) => updateFireAlarmRow(index, "workOrderNumber", event.target.value)}
                            disabled={isReadOnly}
                            className="w-full rounded-lg border border-(--border)/30 px-2 py-1.5 bg-white text-sm text-(--text) disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <SectionActionIconButton
                            onClick={() =>
                              handleSectionActionMenuOpen({
                                sectionKey: `fire-alarm:${index}`,
                                sectionName: row.panel ? `Fire Alarm - ${row.panel}` : "Fire Alarm",
                                details:
                                  `${row.type || "Event"} ${row.messageZone || ""} ${row.actionTaken || ""}`.trim() ||
                                  "Fire alarm event follow-up required.",
                              })
                            }
                            disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
                            linked={isSectionLinked(`fire-alarm:${index}`)}
                            title={
                              isSectionLinked(`fire-alarm:${index}`)
                                ? `Open linked record for fire alarm entry ${index + 1}`
                                : `Create follow-up record for fire alarm entry ${index + 1}`
                            }
                          />
                        </td>
                        {!isReadOnly && (
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeFireAlarmRow(index)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 transition"
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

            <section className="rounded-2xl border border-(--border)/20 bg-white/80 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-(--border)/10">
                <h2 className="text-sm font-semibold text-(--text)">Submission Review</h2>
                <p className="text-[11px] text-(--text)/50 mt-0.5">Confirm all sections are complete before submitting</p>
              </div>
              <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-(--text)">{completedCoverage}<span className="text-sm font-normal text-(--text)/40">/{payload.coverageMatrix.length}</span></p>
                  <p className="text-[10px] text-(--text)/50 font-medium mt-0.5">Coverage</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-(--text)">{reportedIncidentCount}</p>
                  <p className="text-[10px] text-(--text)/50 font-medium mt-0.5">Incidents</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-(--text)">{associatedIncidentReports.length}</p>
                  <p className="text-[10px] text-(--text)/50 font-medium mt-0.5">Incident Reports</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-(--text)">{payload.fridgeLogs.length}</p>
                  <p className="text-[10px] text-(--text)/50 font-medium mt-0.5">Fridge Readings</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-xl font-bold text-(--text)">{payload.fireAlarmEntries.length}</p>
                  <p className="text-[10px] text-(--text)/50 font-medium mt-0.5">Fire Alarm</p>
                </div>
              </div>
              {!isReadOnly && (
                <div className="px-4 py-3 border-t border-(--border)/10">
                  <button
                    type="button"
                    onClick={() => void handleSubmitReport()}
                    disabled={submitting}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit Daily Report"}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── Desktop Navigation ── */}
        <div className="hidden md:flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((previous) => Math.max(previous - 1, 0))}
            disabled={step === 0}
            className="rounded-xl border border-(--border)/20 px-5 py-2.5 text-sm font-medium text-(--text)/70 hover:bg-(--bg) transition disabled:opacity-40"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((previous) => Math.min(previous + 1, STEP_TITLES.length - 1))}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Next: {STEP_TITLES[step + 1]}
              </button>
            ) : (
              !isReadOnly && (
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Daily Report"}
                </button>
              )
            )}
          </div>
        </div>

        {/* ── Mobile Bottom Bar ── */}
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-lg border-t border-(--border)/15 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep((previous) => Math.max(previous - 1, 0))}
              disabled={step === 0}
              className="flex-1 rounded-xl border border-(--border)/20 py-2.5 text-sm font-medium text-(--text)/70 disabled:opacity-40"
            >
              Back
            </button>
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((previous) => Math.min(previous + 1, STEP_TITLES.length - 1))}
                className="flex-[2] rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white"
              >
                Next
              </button>
            ) : (
              !isReadOnly && (
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={submitting}
                  className="flex-[2] rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              )
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <p className="text-[10px] text-(--text)/40 font-medium">
              Step {step + 1}/{STEP_TITLES.length}
              {saving && " · Saving..."}
              {!saving && dirty && !isReadOnly && " · Unsaved"}
            </p>
            {!isReadOnly && !saving && dirty && (
              <button
                type="button"
                onClick={() => void saveDraft()}
                className="text-[10px] font-semibold text-blue-600"
              >
                Save now
              </button>
            )}
          </div>
        </div>
      </div>

      {pendingSectionAction && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={closePendingSectionActionPrompt}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Create Follow-up</h3>
            <p className="mt-2 text-sm text-slate-600">
              Choose which follow-up to create for <strong>{pendingSectionAction.sectionName}</strong>.
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-500">Record type</span>
              <select
                value={pendingSectionAction.actionType}
                onChange={(event) =>
                  setPendingSectionAction((current) =>
                    current
                      ? {
                          ...current,
                          actionType: event.target.value as ActionRecordType,
                        }
                      : null
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="work-order">Create Work Order</option>
                <option value="incident-report">Create Incident Report</option>
              </select>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={closePendingSectionActionPrompt}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPendingSectionAction}
                className={classNames(
                  "rounded-xl px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60",
                  pendingSectionAction.actionType === "incident-report"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
                disabled={creatingAssociatedWorkOrder || creatingAssociatedIncidentReport}
              >
                {creatingAssociatedWorkOrder || creatingAssociatedIncidentReport
                  ? "Creating..."
                  : pendingSectionAction.actionType === "incident-report"
                    ? "Create Incident Report"
                    : "Create Work Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteDailyWarning && report && (
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => {
            if (deletingReport) return;
            setShowDeleteDailyWarning(false);
            setDeleteConfirmInput("");
            setDeleteReportError("");
          }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-red-600">Delete Report</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes <strong>{report.report_date}</strong> and its linked follow-up records.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Type <strong>{report.report_date}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(event) => {
                setDeleteConfirmInput(event.target.value);
                if (deleteReportError) setDeleteReportError("");
              }}
              placeholder={report.report_date}
              className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-300"
              disabled={deletingReport}
            />
            {deleteReportError && <p className="mt-2 text-xs text-red-600">{deleteReportError}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingReport) return;
                  setShowDeleteDailyWarning(false);
                  setDeleteConfirmInput("");
                  setDeleteReportError("");
                }}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                disabled={deletingReport}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteDailyReport()}
                className="rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                disabled={deletingReport}
              >
                {deletingReport ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

