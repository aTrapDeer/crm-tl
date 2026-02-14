# CRM Implementation Scope - 2026-02-14

## Goal
Capture and execute the requested changes across maintenance/work orders, employee invitations, and employee dashboard visibility with clear guardrails and completion criteria.

## Requested Changes (Source of Truth)
1. Rename `Work Orders` to `Change Order` on the maintenance side.
2. Add a new button next to that area named `Bonan Order`.
3. Fix employee invite handling that is failing due to missing Turso table(s), without losing current DB entries.
4. Simplify employee dashboard views to only show assigned project essentials (address, scope, tasks, updates), while hiding pricing and client contact information.

## Scope Boundaries
- In scope:
  - UI terminology updates for maintenance/work-order screens.
  - New `Bonan Order` button placement and wiring.
  - Non-destructive Turso migration and invitation API stabilization.
  - Employee dashboard visibility cleanup.
- Out of scope:
  - Full redesign of admin/client dashboards.
  - Reworking existing project/estimate business logic beyond visibility and invite fixes.

## Workstream A: Maintenance Terminology + New Button
- Objective: Replace maintenance-side `Work Order(s)` naming with `Change Order` while preserving existing data model and routes unless explicitly changed.
- Likely touchpoints:
  - `app/dashboard/management/page.tsx`
  - `app/components/WorkOrderListView.tsx`
  - `app/components/WorkOrderDetailsModal.tsx`
  - `app/dashboard/management/work-orders/new/page.tsx`
  - `app/dashboard/management/work-orders/[id]/page.tsx`
- Deliverables:
  - All visible maintenance labels changed from `Work Order(s)` to `Change Order(s)`.
  - Add `Bonan Order` button adjacent to the primary `Change Order` action area.
  - Button action defined and implemented (route, modal, or placeholder behavior).
- Acceptance criteria:
  - No broken navigation from renamed labels.
  - Existing work-order APIs and records remain functional.
  - `Bonan Order` button is visible and clickable where specified.

## Workstream B: Employee Invite Failures (Turso, Non-Destructive)
- Known failure:
  - `SQLITE_UNKNOWN: no such table: employee_invitations`
  - Failing endpoints include `/api/employees/invitations` and likely related onboarding/custom entry paths.
- Root cause hypothesis:
  - Migration for `employee_invitations` (and possibly related tables) has not run in the active Turso environment.
- Likely touchpoints:
  - `lib/employees.ts`
  - `app/api/employees/invitations/route.ts`
  - `app/api/employees/invitations/[token]/route.ts`
  - `scripts/migrate-employee-invites-and-estimate-custom-entries.ts`
  - `db/schema.sql` (if schema source needs alignment)
- Deliverables:
  - Run/ship idempotent migration that creates missing tables/indexes only when absent.
  - Preserve all current database entries (no destructive schema reset).
  - Validate invite create/list/accept flows end to end.
  - Eliminate 500 responses caused by missing table(s).
- Acceptance criteria:
  - `GET /api/employees/invitations` returns `200`.
  - `POST /api/employees/invitations` returns success with persisted invitation.
  - Invite token acceptance updates status correctly.
  - Existing user/project data remains intact after migration.

## Workstream C: Employee Dashboard Data Visibility
- Objective: Employee view should be simple and role-limited.
- Required UI behavior:
  - Show only projects assigned to the logged-in employee.
  - Show essentials: project name, address, scope/description, tasks, updates.
  - Hide pricing-related data (budget, estimate totals, funding notes/status).
  - Hide client contact information.
- Likely touchpoints:
  - `app/dashboard/employee/page.tsx`
  - `app/components/ProjectDetailsModal.tsx`
  - `app/dashboard/projects/[id]/page.tsx`
  - `app/api/projects/route.ts` (already role-filtered; verify behavior)
- Acceptance criteria:
  - Employee cannot see budget/funding/estimate pricing in list or detail views.
  - Employee cannot see client contact details in dashboard project contexts.
  - Assigned-project filtering remains correct.

## Execution Order
1. Stabilize DB + invitations first (Workstream B) so employee flows stop erroring.
2. Apply maintenance naming/button changes (Workstream A).
3. Apply employee dashboard visibility cleanup (Workstream C).
4. Run regression checks across admin, employee, and client roles.

## Validation Checklist
- [ ] Migration runs safely in Turso without destructive operations.
- [ ] Employee invitation endpoints pass manual API checks.
- [ ] Maintenance UI reflects `Change Order` naming consistently.
- [ ] `Bonan Order` button appears in the agreed location and performs expected action.
- [ ] Employee dashboard hides pricing/client contact fields.
- [ ] Role-based access still works for admin/employee/client.

## Risks and Mitigations
- Risk: Hidden coupling between invite tables and onboarding/custom-entry routes.
  - Mitigation: Verify all related APIs after migration, not only invitation endpoints.
- Risk: Label renames miss some UI surfaces.
  - Mitigation: Search for `Work Order`/`work order` strings and validate key pages manually.
- Risk: Employee details modal may still expose restricted fields through shared components.
  - Mitigation: Gate rendering by `userRole === "employee"` at component level.

## Open Decisions Needed
1. Confirm exact spelling: should button text remain `Bonan Order` (as requested) or be corrected.
2. Define `Bonan Order` button action:
   - Navigate to a new page,
   - Open a modal,
   - Duplicate/new workflow from change order,
   - Or temporary placeholder.
3. Confirm if any API/entity naming should also change from `work_orders` to `change_orders`, or if this is UI-label only.
