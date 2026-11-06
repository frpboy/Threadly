# Sentinel Journal

## 2026-11-04 - Unprotected Admin Endpoints and Answer Leakage
**Vulnerability:** The `/api/admin/*` endpoints (`/api/admin/puzzles`, `/api/admin/publish`, and `/api/admin/generate-ai`) lacked any authentication or authorization controls, and leaked internal database error messages (`details: error.message`). An unauthenticated user could query `/api/admin/puzzles` to retrieve all unpublished puzzles, solutions, and clues in plaintext, or manipulate game schedules via `/api/admin/publish`.
**Learning:** In Next.js route handlers, grouping routes under an `admin/` directory does not automatically protect them without an explicit auth check or Next.js middleware enforcement. Additionally, generic error handlers that echo `error.message` expose internal database topology.
**Prevention:** Enforce centralized authorization checks (such as `verifyAdminRequest` utilizing `ADMIN_SECRET` with constant-time equality comparisons) on administrative routes, fail closed when secrets are absent, and sanitize 500 error responses to omit raw error messages.
