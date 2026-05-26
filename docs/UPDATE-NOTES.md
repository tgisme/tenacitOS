# Update Notes

Lightweight project notes for active TenacitOS work. Keep this file practical: what changed, why it matters, and what should happen next.

## 2026-05-25

### Commerce Work Board

- Added a local Commerce Work Board at `/commerce/work-board`.
- Board columns summarize research, product review, approvals, setup blockers, and ready local work.
- Drawer details stay read-only for commerce data and keep external actions blocked by default.
- Local task creation is available from board items through `POST /api/commerce/work-board`.
- Duplicate open task creation is prevented by matching local tasks with `source.type = "commerce-work-board"` and `source.itemId`.
- Board API now detects existing open commerce tasks and returns them on matching board items as `localTask`.
- Cards and drawer action states show when a local task already exists.

### Commerce Studio Data

- Commerce data currently lives in gitignored JSON files under `data/`.
- Example files are committed for products, trend briefs, approvals, and integrations.
- Runtime files should be initialized from the examples before local use.

### Guardrails

- External commerce writes remain blocked.
- Etsy publishing, Printify ordering, spending money, and customer-facing messages should require explicit human approval before implementation.
- Current commerce features are planning, review, and local task tracking only.

## Next Useful Steps

- Add API-level tests around `GET /api/commerce/work-board` so `localTask` detection is covered at the route response level.
- Add a small Work Board screenshot after the UI settles.
- Document the commerce JSON schemas once the fields stop moving.
- Consider a short `docs/COMMERCE.md` if the commerce workflow grows beyond these notes.
