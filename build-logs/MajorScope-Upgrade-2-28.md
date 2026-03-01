# TL Corp CRM Portal v20.0 — FINAL Master Specification  
**Offline + Timeline + Performance Hardened**  
**Date:** 2026-02-25  
**Status:** This version supersedes all prior versions.

---

## 1. Offline Field Mode (Required Implementation)
The system must support reliable jobsite usage in low or no connectivity environments.

- Offline capture allowed for: **Action Items, Photos, Daily Reports, Time Entries**
- Offline entries stored locally with visible **“Pending Sync”** indicator
- Automatic background sync when connection restored
- Conflict resolution rule: **server version prevails unless user manually resolves conflict**
- Clear sync status icon:
  - **Green = Synced**
  - **Yellow = Pending**
  - **Red = Error**
- **No data silently lost** due to connectivity issues

---

## 2. Project Activity Timeline (Enterprise Clarity Layer)
Each **Project Workspace** must contain a unified chronological activity feed.

- Timeline includes:
  - Assignments
  - Action Item changes
  - Photo uploads
  - Daily Report submissions
  - Document views
  - Change Order events
  - Invoice events
  - Status changes
- Events sorted **newest → oldest**, with **timestamps** and **user names**
- Filter by event type (e.g., only CO events)
- Each timeline entry links to the source object
- Timeline must be exportable as part of the **Dispute Defense Packet**

---

## 3. Performance & Responsiveness Guarantees
Performance is a competitive differentiator. Targets are **required**:

- Today Dashboard render: **< 2s** on standard **4G**
- Project Workspace initial load: **< 2s**
- Action Item creation perceived response: **< 1s**
- Photo compression before upload to reduce latency
- Lazy load image galleries
- Skeleton loaders for perceived speed improvement

---

## 4. Stability & Data Protection Standards
- All uploads stored with **retry logic**
- All background jobs (notifications, AI, exports) use **queue system**
- Automatic **nightly database backups**
- Exportable **full project archive**
- Server-side validation on all create/update operations

---

# TL Corp CRM Portal v18.0 — FINAL Consolidated Implementation Specification  
**Date:** 2026-02-25  
**Replacement note:** Use this specification as the **sole source of truth**. If any prior PDF conflicts with this version, **this version prevails**.

---

## Terminology Lock (Authoritative)
The following terms are official and must be used consistently across UI, database, and documentation:

- **Project Workspace** (primary project detail screen; replaces prior “Job Bible” references)
- **Action Items** (replaces Task / Work Item terminology)
- **Daily Report** (replaces Daily Log)
- **Project Documents**
- **Project Photos**
- **Time Entries**
- **Work Orders** (reserved exclusively for Maintenance division service tickets)
- **Admin Console**
- **Today Dashboard**
- **Client Portal**

> Any reference to “Task”, “Work Item”, or “Job Bible” in prior documents should be interpreted as **Action Item** and **Project Workspace** respectively.

---

# TL Corp CRM Portal v16.0 — SUPERNOVA Master Specification  
**Date:** 2026-02-23  
**Note:** Treat v16 as the source of truth unless superseded.

---

## 1. Market Benchmark Findings (What the top systems do well)
Patterns seen across leading platforms (Procore, Buildertrend, Jobber, JobTread):

- **Centralized hub:** schedule, COs, daily logs, punch/tasks connected
- **Field speed:** quick field capture and offline-tolerant behavior
- **Client calm:** transparency without exposing internal noise
- **Service velocity:** recurring visits + work orders + checklists (maintenance)
- **Profit protection:** COs derived from budget items; reduce duplicate entry
- **Mobile parity:** critical workflows must work on phone in seconds

---

## 2. The Simplification Doctrine (Same results, fewer taps)
- Keep employee UI stable: **Today → Project Workspace → Action Items/Photos/Time/Daily Report**
- Make Admin the complexity sink: RFIs/Submittals/Budget/Publishing/Reporting live in Admin
- Client sees curated output only: Updates, Published photos/docs, Selections (residential), CO approvals, Billing
- Templates everywhere: divisions/portfolios auto-load tasks, checklists, required photos, closeout gates
- One object model: Projects + Work Orders share patterns (maintenance is a division/portfolio + templates)
- Never require training calls: tooltips, guided tours, microcopy, confirmations, undo, drafts

---

## 3. Division + Portfolio Architecture (Replace 5 apps with 1 portal)

| Context | What it controls | What it must NOT change |
|---|---|---|
| **Division** (Residential/Commercial/Maintenance) | Templates, enabled modules, default workflows, reporting buckets | Core entities, employee navigation shell |
| **Portfolio** (Bonan Towers, future maintenance contracts) | Checklist libraries, recurring schedules, asset/location lists | User identity, base permissions model |

---

## 4. Minimum Gap-Closers to Match the Top Dogs (without bloat)
- Residential: **Selections/Allowances + Warranties/Callbacks**
- Commercial: **RFI Lite + Submittal Lite + Drawings/Plans (latest) + Inspections/Observations (templated)**
- Maintenance: **Work Orders + Client requests + Recurring visits + Forms/Checklists library**
- Profit: **Budget/Cost Codes Lite + Change Orders built from budget items**

---

## 5. How to Use This Document (Implementation map)
- **Section A**: benchmark direction + simplification rules
- **Appendix 1 (v12)**: canonical functional+technical spec (data model, RBAC, events, API shapes, acceptance tests)
- **Appendix 2 (v13)**: solo-dev playbook (screen-by-screen buttons, validations, toasts, error states)
- **Appendix 3 (v15)**: benchmark upgrade addendum (divisions/portfolios, module activation, missing ROI modules)

**Developer instruction:** Build Phase 1 exactly to the Employee/Client/Admin core flows first, then add benchmark modules per v15 **without changing the employee shell**.

---

# Appendix 1 — TL Corp CRM Portal v12.0  
**FULL Functional + Technical Specification (SRD/PRD Hybrid)**  
**Date:** 2026-02-17  
**Prototype:** crm-tl.vercel.app

---

## 0. Non-Negotiables (Definition of Success)
- Post-login behaves like an app (SPA): instant transitions, persistent nav, no full reloads
- RBAC enforced server-side (clients only own jobs; employees only assigned jobs; admins control all)
- **3-Tap Rule** from Employee Today: Navigate, Open Job, Clock In/Out, Add Photo, Add Action Item
- Auto-save drafts everywhere + Resume Draft
- Immutable audit trail for critical events (schedule/scope/approvals/publishing/deletes)
- Electronic signatures with version lock + signed PDF snapshot
- Document tracking events: Sent/View/Sign tied to document version, with notifications
- Replace paper workflows completely (daily reports, approvals, closeout packets)
- Usability: no training calls; in-app help + tooltips + microcopy required

---

## 1. Product Scope & Portal Breakdown
One system, one database, three portal shells:

- **Employee Portal (mobile-first):** Today/Week, Project Workspace, Fast capture, acknowledgments
- **Client Portal (calm + curated):** Overview, Updates, Published Photos, Documents, Change Orders, Billing/Payments, Messages
- **Admin Portal (desktop-first):** Dashboard, Jobs, Schedule/Dispatch, Publish Queue, COs, Invoices, Users/Roles, Templates, Reports

---

## 2. Branding + Design System (Tokens are mandatory)
Tokens must be implemented once and consumed everywhere (no per-component hardcoding).

- Logo: fixed top-left; aspect ratio maintained; clearspace ≥ height of “T”
- Colors:
  - Primary TL Blue: **#0B2A4A**
  - Accent Gold: **#C7A252**
  - Success: **#16A34A**
  - Warning: **#F59E0B**
  - Danger: **#DC2626**
- Typography: Inter preferred (fallback system-ui)
- Spacing: 8pt grid (4/8/12/16/24/32/48/64)
- Tap targets: **44×44px** minimum; button height 44–48px; input height 44px
- Component set: AppShell, TopBar, Card, Button variants, Badge, Modal, Drawer, Toast, Skeleton, EmptyState, Stepper/Wizard, FileUpload, Table

### 2.1 UI State Matrix (Every component)
- Default, Hover (desktop), Pressed, Focus ring (**2px #60A5FA**), Disabled, Loading, Error, Success
- Every primary action must produce: visible state change + success toast + (if relevant) audit event

---

## 3. Recommended Technical Architecture
- Frontend: SPA shell (Next.js app router or similar), role-based route guards, responsive layout
- Backend: REST or GraphQL; server-side authorization; background jobs via queue
- DB: PostgreSQL (preferred) with UUID primary keys; row-level access enforced in service layer
- Files: S3-compatible storage for photos/docs; thumbnails; metadata in DB
- Search: DB search initially; optional full-text later
- Observability: request logging + error tracking; audit export endpoints
- Security: HTTPS only; secure sessions; optional 2FA for admin

---

## 4. Data Model (Core Tables / Objects)
Core objects (canonical, stable):

- User, Role, Permission, UserProjectAccess
- Project, ProjectClientLink, Assignment, Milestone
- ActionItem, ActionItemComment, ActionItemAttachment
- Photo, PhotoComment, PhotoPublishRequest
- Document, DocumentVersion, DocumentRecipient, DocumentEvent
- DailyReport, DailyReportSection, DailyReportAttachment
- TimeEntry, TimeEntryEditRequest
- ChangeOrder, ChangeOrderVersion, ChangeOrderSignature
- Invoice, Payment, Receipt
- MessageThread, Message, MessageAttachment
- AuditLog (immutable)

### 4.1 Project (Job) schema (required fields)
| Field | Requirement |
|---|---|
| id | UUID |
| job_number | String unique; format configurable (e.g., 26-014) |
| name | String; required |
| type | Enum: Residential / Commercial / Maintenance / Service / Warranty |
| status | Draft → Scheduled → Assigned → Acknowledged → In Progress → Pending Review → Complete → Closed/Archived |
| address | Structured street/city/state/zip + geo lat/long |
| access_notes | Text; optional |
| work_hours_allowed | Text/structured; optional |
| scope_summary | Text; required (admin) |
| today_target | Text; optional (employee-facing) |
| safety_notes | Text; optional |
| lead_user_id | FK User; required once scheduled |
| created_by | FK User; required |
| created_at / updated_at | timestamps |

### 4.2 Assignment (ScheduleItem) schema
| Field | Requirement |
|---|---|
| id | UUID |
| project_id | FK Project; required |
| start_at | datetime; required |
| duration_minutes | int; required |
| assigned_user_ids | array FK Users; required |
| status | Draft / Assigned / Acknowledged / Completed |
| priority | Normal / Urgent / Emergency |
| critical_note | short text shown on Today card; optional |
| changed_since_last_login_flag | computed per user |
| created_by / updated_by | FK User |
| created_at / updated_at | timestamps |

---

## 5. Roles & Permissions (RBAC)
RBAC must be enforced server-side.

| Module | Client | Employee | Lead/Foreman | Admin |
|---|---:|---:|---:|---:|
| Projects/Jobs | R (own) | R (assigned) | R (assigned) | CRUD |
| Assignments/Schedule | R (own) | R (assigned) | R (assigned) | CRUD |
| Action Items | R (published opt.) | CRU (assigned) | CRU (assigned) + Assign | CRUD + Verify |
| Photos | R (published) | CR (internal) | CR (internal) | CRUD + Publish |
| Docs | R (published) | R (assigned) | R (assigned) | CRUD + Publish |
| Daily Reports | R (published summary opt.) | CRU (own draft) | CRU + Submit | CRUD + Export |
| Time | N/A | CRU (own) | CRU (crew view opt.) | CRUD + Approve |
| Change Orders | CRU (approve/decline) | R | R | CRUD + Send |
| Invoices/Payments | R + Pay | N/A | N/A | CRUD |
| Messages | R/W (admin thread) | R/W (job thread) | R/W | CRUD + Moderate |
| Audit/Reports | R (own exports opt.) | N/A | N/A | R + Export |

---

## 6. Notification Engine (Required)
- Channels: in-app bell (**required**), email (configurable), SMS (phase 2)
- Notifications must deep-link to the exact object
- Anti-spam: view events notify once per recipient; subsequent views batched into activity feed/summary
- Types include: assignment created/changed, action item assigned/blocked, publish request, doc viewed/signed, CO approved/declined, invoice paid, daily report submitted, safety acknowledgment

### 6.1 Document tracking events (canonical)
Created, Sent, Delivered (optional), Opened (optional), Viewed, Downloaded (optional), Signed/Approved, Declined, Expired, Revoked.

### 6.2 AuditLog events (immutable)
Schedule changes (old/new), job status changes, action item status changes, publish actions, signature events, deletions/archives, reopen daily report with reason.

---

## 7. Employee Portal — Screen Specifications
**Guiding rule:** optimized for phone/iPad, low typing, big actions; every screen has a 1-line “What to do here” + Help icon.

### 7.1 E1 Today (Default)
- Loads today’s assignments sorted by start time
- Job card fields: start time, job name/number, address (truncate), crew, priority tags, critical note
- Primary buttons: Navigate, Open Job, Clock In
- Banner if updates since last login → opens Change Summary drawer
- Long-press card → quick actions: Add Photo, Add Action Item, Message Admin, View Docs
- Empty state: No assigned work today + View My Week + Message Admin

### 7.3 E3 Project Workspace (Shell)
- Sticky critical info: Address (Navigate), Access notes, Scope summary, Today target, Safety/PPE, Contacts (tap-to-call)
- Tabs max 6: Action Items, Photos, Docs, Daily Report, Time, Messages
- More menu: Request Materials, Report Issue, View Change Summary

### 7.4 E4 Action Items
- Sections: Open, In Progress, Blocked, Completed (collapsed)
- + New Action Item
- Swipe left = Complete (confirm), swipe right = Block (confirm)
- Block requires reason dropdown + optional note/photo
- Complete requires photo for categories QA/Safety/Punch (configurable)

### 7.6 E6 Photos
- + Photo opens camera; post-capture requires Tag (Before/During/After)
- Visibility defaults Internal; employee can Request Publish → creates admin queue item
- Viewer supports comments; delete rules: uploader within 10 min or admin; Undo 10 min

### 7.8 E8 Daily Report
- Status: Not started / Draft / Submitted
- Sections: Work performed, Deliveries, Issues/Blocks, Safety, Client interaction
- Auto-save every 10 seconds; Submit locks; admin reopen requires reason (audit)
- If Issues entered → prompt “Create action item from this?”

### 7.9 E9 Time
- Clock in/out by job; show running timer
- Switch Job stops current and starts new (logs both)
- Break prompt at clock-out if missing
- Edit requests allowed; admin approves

---

## 8. Client Portal — Screen Specifications
Client portal must be calm, curated, non-technical. Clients see only published items.

- **C1 Overview:** status, milestones, next steps; action items (approve CO, pay invoice, message admin)
- **C2 Updates:** weekly/date cards with summary + published photos + linked docs
- **C3 Photos:** published only; albums Before/During/After
- **C4 Documents:** contracts/estimates/CO PDFs (view-only default)
- **C5 Change Orders:** pending first; approve w/ e-sign; decline requires reason
- **C6 Billing:** invoice list/detail; pay; receipt download; payment event logged
- **C7 Messages:** client↔admin only

---

## 9. Admin Portal — Screen Specifications
Admin is control center: job creation, scheduling, approvals, publishing, reporting.

- **A1 Dashboard:** today jobs, blocked action items, publish requests, pending CO approvals, unpaid invoices, crew utilization
- **A3 Create Project Wizard:** Client/Address/Type → Scope/Access/Hours/Safety → Template → Schedule/Crew → Client visibility → Finish
- **A4 Schedule/Dispatch:** assignments; changes trigger “Updated since last login”
- **A5 Publish Queue:** photo/doc publish requests, update drafts; publish logs publisher + timestamp
- **A6 Change Orders:** create/send; track view/sign; approved version locked; optional invoice generation
- **A9 Reports/Exports:** dispute defense packet; audit export; daily report export with embedded photos

---

## 10. Legal-Grade Workflows (Paper Replacement)
### 10.1 Signature capture requirements
- Typed name + drawn signature (optional upload)
- Capture signer name/email/role, timestamp, IP/device/user-agent optional
- After signature: generate locked PDF snapshot, store in immutable archive folder, version lock

### 10.2 Daily report legal standard
- Unlimited photos stamped with user+timestamp
- Logs locked on submit; reopen requires reason + audit
- Export PDF includes text + embedded photos + timestamps

### 10.3 Closeout & signoff
- Completion gate: required action items/photos/checklists satisfied before Complete
- Optional client on-site completion signature; warranty acknowledgment; punch signoff

---

## 11. API Expectations (Reference Contract)
Recommended REST shape:

- Auth: `POST /auth/login`, `POST /auth/logout`, `POST /auth/register`
- User: `GET /me`
- Projects: `GET /projects`, `POST /projects`, `GET /projects/:id`, `PATCH /projects/:id`, `POST /projects/:id/archive`
- Assignments: `POST /assignments`, `GET /assignments/today`, `GET /assignments/week`, `PATCH /assignments/:id`
- Action Items: `POST /tasks`, `GET /projects/:id/tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/block`, `POST /tasks/:id/complete`
- Photos: `POST /photos`, `GET /projects/:id/photos`, `POST /photos/:id/publish-request`, `POST /photos/:id/publish`
- Daily Reports: `POST /daily-logs/start`, `PATCH /daily-logs/:id`, `POST /daily-logs/:id/submit`, `POST /daily-logs/:id/reopen`
- Time: `POST /time-entries/clock-in`, `POST /time-entries/clock-out`, `POST /time-entries/switch-job`
- COs: `POST /change-orders`, `POST /change-orders/:id/send`, `POST /change-orders/:id/approve`, `POST /change-orders/:id/decline`
- Invoices/Payments: `POST /invoices`, `POST /invoices/:id/send`, `POST /payments`
- Docs: `GET /documents/:id/viewer`, `GET /documents/:id/events`
- Audit/Exports: `GET /audit?project_id=...`, `GET /exports/dispute-packet?project_id=...`

---

## 12. Acceptance Test Scenarios (QA Checklist)
Build is not complete until all pass on iPhone, iPad, and desktop:

- EMP-01: Today loads <2s and shows correct assignments
- EMP-02: Clock in from Today → timer starts → toast → time entry created
- EMP-03: Add action item → block with reason → admin sees blocked item → audit exists
- EMP-04: Submit daily report with photos → locks → export PDF contains embedded photos
- CLI-01: Client opens contract link → admin gets “Viewed” alert
- CLI-02: Client signs contract/CO → signed PDF snapshot stored → admin gets “Signed” alert
- ADM-01: Admin creates project + schedule → employees notified → “Updated since last login” works
- ADM-02: Admin publishes photos → client sees immediately, internal remain hidden
- ADM-03: Dispute packet export includes contract, COs, logs, photos, audit timeline
- SEC-01: Client cannot access another client’s project via URL manipulation (RBAC)

---

## 13. Delete/Archive Rules (Controlled Destruction)
- Projects: never hard-delete; **Archive only**
- Action items: creator may delete within 10 minutes; after that admin only; otherwise cancel (kept in audit)
- Photos: uploader may delete within 10 minutes; otherwise admin only; Undo 10 minutes
- Docs: never delete versions; upload creates new version; old versions remain read-only
- Messages: never delete; allow rare admin redaction with audit note

---

# Appendix 2 — TL Corp CRM Portal v13.0  
**Solo-Developer Implementation Playbook (Buttons, Screens, Flows, States)**  
**Build order:** Auth/RBAC shells → core components → employee flows → admin flows → client flows → legal locks + audit → doc tracking + notifications → exports

(For full button-by-button details and ASCII wireframes, refer to the source PDF.)

---

# Appendix 3 — TL Corp CRM Portal v15.0  
**Market Benchmark Upgrade Addendum**  
Key additions:
- Division + Portfolio selector (templates/defaults/modules; core data model unchanged)
- Module activation matrix (keep employee UI stable)
- Residential: Selections/Allowances + Warranties/Callbacks
- Commercial: RFI Lite, Submittal Lite, Drawings/Plans, Inspections/Observations Lite
- Maintenance: Work Orders, Recurring Visits, Forms/Checklists library
- Job Costing Lite + CO-from-Budget Items
- Document tracking enhancements (per-recipient; reminders)
- Timeline view created→sent→viewed→signed

---

# TL Corp CRM Portal v17.0 — FINAL BOSS Addendum
- “Job Bible” is internal; public label should be **Job Details**
- Default decisions: drawers over modals for multi-step; tabs over nested routes; optimistic UI w/ rollback; archive instead of hard-delete; UUID IDs; UTC timestamps; server-side RBAC
- Legal locks: signed versions immutable; edits require new version + new signature
- Final acceptance trigger includes passing v12/v13/v15 and generating dispute packet under 30s

---

# TL Corp CRM Portal v19.0 — AI Assist Addendum (Admin + Employee + Client)
AI principles:
- Assist, not replace; always editable; optional suggestions; log every AI interaction; never auto-publish; must reduce taps

AI modules:
- Weekly Update Draft Generator (Admin)
- Daily Report Assistant (Employee: voice→structured + suggestions)
- Scope Completeness Checker (Admin)
- Action Item Suggestor (Admin/Employee)
- Dispute Summary Generator (Admin/Management)
- Command Assistant (global chat drawer)
- Photo auto-tagging + caption suggestions

AI logging tables:
- AIActionLog (id, user_id, project_id, feature_type, input_refs, output_text, accepted_boolean, created_at)
- AIFeatureFlags (enable/disable per role/division)
- Privacy and retention aligned with project policy

