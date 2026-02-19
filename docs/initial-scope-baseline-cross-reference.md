# TL Corp CRM Initial Scope Baseline + Cross-Reference

Date captured: 2026-02-17
Context: Consolidated from prior agreed scope notes, in-thread requests, and current implementation references.

## 1) Baseline Scope (Agreed Before New v12 Expansion)

The following were part of the agreed/active build direction before the full v12 expansion request:

1. Core role-based portal with `admin`, `employee`, and `client` access.
2. Project management essentials:
   - Create/update projects.
   - Task management.
   - Project updates.
   - Photo uploads.
3. Client and employee invitation/onboarding flows.
4. Project signatures and approval flow for `admin` + `client`.
5. Signature invalidation rule:
   - If project data is edited, existing project signatures are wiped and must be re-signed.
6. Employee visibility restrictions:
   - Employee should only see assigned project essentials, tasks, photos, updates, and progress context.
7. Maintenance/work-order area continuity with naming/UI adjustments.
8. Incremental UX/admin polish (users management, search field UI, edit controls, etc.).
9. Project estimate visibility controls for client-facing views:
   - Hide line-item pricing.
   - Hide markup details.
10. PDF export improvements to match provided invoice style and include required disclosures.
11. Settings/account security baseline:
   - Password change page and endpoint.

## 2) Source Scope Notes Already in Repo

1. `docs/implementation-scope-2026-02-14.md`
   - Active scope and boundaries.
2. `1-27-26-order.md`
   - Role terminology (`worker` -> `employee`), client change-request pipeline, full project editability, admin UI usability requests.
3. In-thread follow-up requests already handled in current workstream:
   - Admin user delete + confirm modal.
   - Edit project name/update flow.
   - Users search icon overlap fix.
   - Settings page + password change.
   - Client estimate/PDF visibility rules.
   - PDF styling/disclosures/logo fixes.
   - Employee portal data exposure restrictions.
   - Signature wipe-on-edit behavior reaffirmed.

## 3) Cross-Reference: Baseline Scope -> Current Code

| Baseline item | Current implementation reference(s) |
|---|---|
| Role-based sessions/auth | `lib/auth.ts`, `app/api/auth/session/route.ts`, `app/dashboard/layout.tsx` |
| Admin-only user deletion | `app/api/users/route.ts` |
| Delete-user confirm/cancel UX | `app/dashboard/users/page.tsx` |
| Project signatures (admin/client) | `app/api/projects/[id]/signatures/route.ts`, `lib/projects.ts` (`project_signatures`) |
| Signature wipe when project is edited | `app/api/projects/[id]/route.ts` (`clearProjectSignatures`), plus estimate/tasks/images/updates/assignments routes also clear signatures |
| Project editing (name and other editable fields) | `app/api/projects/[id]/route.ts`, `app/dashboard/projects/[id]/page.tsx`, `app/components/ProjectDetailsModal.tsx` |
| Hide client line-item prices/markup | `db/schema.sql` (`projects.hide_line_item_prices_for_client`, `projects.hide_markup_for_client`), `app/api/projects/[id]/estimate/route.ts`, `app/dashboard/projects/[id]/page.tsx` |
| PDF export style/disclosures/logo improvements | `app/api/projects/[id]/export-pdf/route.ts`, `examples/Example Invoice.pdf` |
| Settings + password change | `app/dashboard/settings/page.tsx`, `app/api/auth/change-password/route.ts` |
| Employee assignment filtering | `app/api/projects/route.ts`, `app/api/projects/[id]/route.ts`, `app/api/projects/[id]/team/route.ts` |
| Employee dashboard simplification workstream | `app/dashboard/employee/page.tsx`, `app/components/ProjectDetailsModal.tsx`, `docs/implementation-scope-2026-02-14.md` |

## 4) Cross-Reference: Baseline Scope vs New v12 Spec

Reference docs:
- `examples/new-instructions/TL_Corp_CRM_Portal_v12_FULL_Functional_Technical_Spec.pdf`
- `examples/new-instructions/TL_Corp_CRM_Portal_v7_Ultimate_Spec_DesignSystem_Branding_Clickflows.pdf`

### Already aligned or partially aligned with baseline

1. Role-based portals and assignment-based access.
2. Signature capture and project approval behavior.
3. Client-safe estimate visibility (line-item/markup hiding).
4. PDF invoice/disclosure styling improvements.
5. User/admin controls and settings/password workflow.

### Net-new additions beyond baseline scope (change-order territory)

1. Full legal-grade lifecycle and immutable audit event model.
2. Complete document event engine (sent/viewed/signed/declined/expired/revoked).
3. Daily logs module with lock/reopen audit controls.
4. Timekeeping module (clock in/out, switch jobs, approvals).
5. Full publish-queue workflow for client-facing content release.
6. Broader reporting/export bundles (dispute packet-grade output).
7. Full acceptance-test matrix and deeper operational QA criteria across all portals.
8. Expanded schema/API surface for all above modules.

## 5) Explicit Agreement Note (Reaffirmed)

The project signature + approval workflow and the rule "project edits clear existing signatures" are part of baseline agreed scope and should be treated as in-scope behavior, not as new expansion.

## 6) Use of This Document

Use this file as the practical baseline when discussing whether new requests are:
1. Included refinements to existing agreed functionality, or
2. Added modules/workflows requiring budget and timeline expansion.

