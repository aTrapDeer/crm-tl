# Detailed Gap Justification (Line-by-Line) for an Additional ~$2,000

Scope reference: [MajorScope-Upgrade-2-28.md](e:/Coding/crm-tl/build-logs/MajorScope-Upgrade-2-28.md)  
Current implementation evidence: [db/schema.sql](e:/Coding/crm-tl/db/schema.sql), [ProjectDetailsModal.tsx](e:/Coding/crm-tl/app/components/ProjectDetailsModal.tsx), [projects/[id]/page.tsx](e:/Coding/crm-tl/app/dashboard/projects/[id]/page.tsx), [bonan daily offline editor](e:/Coding/crm-tl/app/dashboard/management/bonan/daily/[id]/page.tsx), [sw.js](e:/Coding/crm-tl/public/sw.js), [baseline scope note](e:/Coding/crm-tl/docs/initial-scope-baseline-cross-reference.md)

1. Offline capture for **Action Items** is not implemented platform-wide.  
Current state: tasks exist, but no general offline task queue/sync for core project tasks.

2. Offline capture for **Project Photos** is not implemented platform-wide.  
Current state: photo upload is online API-based; no queued offline upload with conflict handling.

3. Offline capture for **Daily Reports** exists only for Bonan daily flow, not full CRM modules.  
Current state: localized offline queue in Bonan editor only.

4. Offline capture for **Time Entries** is missing entirely.  
Current state: no `time_entries` module/table/endpoints in [db/schema.sql](e:/Coding/crm-tl/db/schema.sql).

5. Required global **Pending Sync indicator** (green/yellow/red) is not implemented across CRM.  
Current state: Bonan has text sync status; no unified status system across modules.

6. Required **conflict resolution rule** (“server wins unless manual resolve”) is not implemented as a reusable platform policy.  
Current state: no shared conflict-resolution workflow in core project modules.

7. Unified **Project Activity Timeline** is missing.  
Current state: there are project updates, but no single timeline entity aggregating assignments, photos, docs, COs, invoices, status changes, etc.

8. Timeline **filters by event type** and **deep links to source objects** are missing.  
Current state: no timeline feed component with event-type filter controls.

9. Timeline export into **Dispute Defense Packet** is missing.  
Current state: project export exists, but not full dispute packet with consolidated legal audit timeline.

10. **Performance guarantees** (<2s dashboard/workspace, <1s action response) are not instrumented or enforced.  
Current state: no measurable performance budget/RUM thresholds in codebase.

11. **Photo compression before upload** is not implemented as an enforced pipeline.  
Current state: uploads exist, but no client-side compression standard before transfer.

12. **Upload retry logic** is partial/non-unified.  
Current state: no centralized retry policy for all upload surfaces.

13. Required **background queue system** for notifications/AI/exports is missing.  
Current state: emails are mostly fired directly in request cycle (`send...().catch(...)`), not queued worker jobs.

14. **Nightly database backups** are not represented in application code/deployment scripts.  
Current state: no backup scheduler workflow in repo.

15. **Exportable full project archive** is not implemented as a complete archive package workflow.  
Current state: there is an estimate/invoice-style PDF export, not complete archive packaging.

16. **Server-side validation on all create/update operations** is incomplete.  
Current state: many endpoints validate basics, but no unified strict validation layer across all entities.

17. v18 terminology migration to **Action Items / Project Workspace / Daily Report** is incomplete.  
Current state: app still primarily uses “Tasks” and current route/model naming.

18. v12+ legal/audit model (immutable event history, full legal-grade locks beyond current signatures) is not fully implemented.  
Current state: signatures exist, but full legal-grade lifecycle/audit breadth is not present.

19. Core enterprise modules in the major doc (timekeeping, richer CO/invoice event chain, publish queue depth, etc.) are only partial or absent.  
Current state: work orders/docs/signatures exist, but not full major-spec breadth.

20. v19 AI suite is mostly absent (only AI task generation exists).  
Current state: no AI interaction logging framework/tables matching v19 breadth.

## Why this can justify ~$2,000 even after $2,500 + maintenance

1. This is mostly **new feature development**, not bug fixing.  
2. The repo’s own baseline note marks many v12+ items as **change-order territory**: [initial-scope-baseline-cross-reference.md](e:/Coding/crm-tl/docs/initial-scope-baseline-cross-reference.md).  
3. A realistic low-end implementation for the missing major items is roughly **35–50 engineering hours**.  
4. At a conservative rate of **$45–$60/hr**, that is **$1,575–$3,000**.  
5. So **$2,000** is defensible for a scoped subset of this major upgrade.

## What should usually stay under monthly maintenance ($400/mo)

1. Bug fixes (like permission/cache inconsistencies).  
2. Minor UI text/label changes.  
3. Small report field edits and light workflow polish.  
4. Routine dependency/security updates and ops support.
