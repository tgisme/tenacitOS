# Commerce Studio

Commerce Studio is the local-first workspace for developing product ideas, reviewing marketplace readiness, and tracking setup work before any external shop is connected.

The current implementation is intentionally conservative: it can organize local research, drafts, approvals, integration setup, and task follow-up. It must not publish listings, place orders, spend money, edit a live shop, or contact customers without explicit human approval.

## Surfaces

- `/commerce` tracks product drafts and review decisions.
- `/commerce/trends` tracks trend briefs, evidence, and product conversion candidates.
- `/commerce/approvals` records human approval decisions and local-only execution notes.
- `/commerce/integrations` tracks Etsy, Printify, and other provider setup blockers.
- `/commerce/work-board` summarizes active commerce work into research, review, setup, and ready-local columns.

## Data Files

Runtime commerce data lives in gitignored JSON files under `data/`. Example files are committed and should be copied during setup.

- `data/commerce-products.json` from `data/commerce-products.example.json`
- `data/commerce-trends.json` from `data/commerce-trends.example.json`
- `data/commerce-approvals.json` from `data/commerce-approvals.example.json`
- `data/commerce-integrations.json` from `data/commerce-integrations.example.json`
- `data/tasks.json` from `data/tasks.example.json`

Local tasks created from the Work Board are stored in `data/tasks.json` with `source.type = "commerce-work-board"` and `source.itemId` set to the board item id. The board treats matching non-`done` tasks as existing work and exposes them as `localTask`.

## Statuses

Product statuses:
`researching`, `proposed`, `designing`, `listing-ready`, `needs-review`, `approved`, `published`, `selling`, `paused`, `rejected`, `revision`

Trend statuses:
`watching`, `promising`, `converted`, `dismissed`, `archived`

Approval statuses:
`requested`, `approved`, `rejected`, `needs-revision`, `executed-locally`

Integration provider statuses:
`not-connected`, `configured`, `syncing`, `healthy`, `needs-attention`, `disabled`

Integration checklist statuses:
`todo`, `in-progress`, `done`, `blocked`

## Work Board Rules

The Work Board is a read-only summary of local commerce state, plus local task creation.

- Research shows `watching` and `promising` trend briefs.
- Review shows product drafts in `proposed`, `listing-ready`, `needs-review`, or `revision`, plus approvals in `requested` or `needs-revision`.
- Setup Blockers shows integrations whose provider status is not `healthy`.
- Approved Local Work shows products in `approved`, `published`, or `selling`, plus approvals in `approved` or `executed-locally`.
- Creating a local task from a board card must not create a duplicate if an open matching commerce task already exists.
- Completed tasks with `lastStatus = "done"` do not count as existing open work.

## Guardrails

Allowed without extra approval:

- Research trends and record evidence.
- Draft product ideas, pricing assumptions, tags, and listing copy locally.
- Record review decisions and risk notes.
- Track integration setup steps.
- Create local follow-up tasks.

Requires explicit human approval before implementation or execution:

- Etsy OAuth connection or credential storage.
- Printify API token setup.
- Any write to Etsy, Printify, or another external commerce API.
- Publishing, editing, or deleting a shop listing.
- Creating or submitting fulfillment orders.
- Spending money.
- Messaging customers or making customer-facing claims.

## Near-Term Direction

The next useful commerce work should keep strengthening the local operating surface before enabling real integrations:

- Add quick Work Board filters for review state, task state, blocked setup, and ready-local items.
- Refresh Work Board data after local task creation so cards update immediately.
- Add screenshots once the Work Board UI settles.
- Add dry-run payload logging before any Etsy or Printify write path exists.
