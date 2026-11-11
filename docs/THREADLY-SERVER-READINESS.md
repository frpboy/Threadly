# Threadly server candidate, November 7, 2026

Preparation only. This candidate has not been pushed or deployed, and has not changed the production database.

## Source integration

Base: d947a60019e7f68abe060c96ee081f2bccfa56d9.
Preserves the earlier local server-scoring branch through 85eb878d72d8a8110278110430d66939046cde4e.
Compared against remote fix/android-progress-api-20261107 at 9faf848c8255633a6bae0a65606a2ed20eb75512. No authorship attribution is established for that branch.

Retained the partial unique index, ON CONFLICT insert, and all-or-nothing guess/award transaction from the local candidate rather than replacing them with the other branch's route implementation. Incorporated the other branch's dependency versions, root workspace install/build CI pattern and nested lockfile removal. Added PGlite to that lockfile for the existing transaction tests. Removed Sentry's obsolete hideSourceMaps option; the installed Sentry implementation uses hidden-source-map for client builds.

## Changes after the earlier review

- Reject non-string, empty and over-200-character guesses before database or answer-matcher work; bound identifiers too. Reject unpublished puzzles in guess, matching progress.
- Disable public client-supplied leaderboard scores with 405. Leaderboard GET is now read-only and returns an empty result when no season exists. Transactional guess scoring is the only remaining leaderboard writer in this source tree.
- Read legacy NULL-key guesses by identity as well as keyed rows. Prefer any correct historical row within a clue slot, then the earliest row, to avoid hiding an old solve. Guests cannot inherit signed-in rows sharing the same guest ID.
- Make the migration catch-up repeatable when a newer keyed slot already exists. Existing keyed rows and legacy duplicates are not deleted.
- Serialize player award updates with a transaction advisory lock so different puzzles cannot overwrite the same player's stats/streak. Serialize leaderboard creation/update with one transaction advisory lock. These protect cooperating new writers, not old deployed code or direct SQL. Historical duplicate seasons/entries are not repaired.
- Return private,no-store headers on guess/progress/leaderboard JSON responses, including errors.
- Add regression tests against the actual transpiled route source with fake external services, plus SQL tests in PGlite for the legacy window and catch-up behavior.

## Evidence for this local candidate

- Root npm ci succeeds after dependency integration.
- 30 node tests pass, no failures or skipped tests: 20 earlier tests plus 10 validation, SQL and route-guard cases.
- Prisma client generation and TypeScript typecheck pass.
- Actual Next.js 16.4.5 production webpack build succeeds through compilation, typecheck, static generation and build traces, using only local placeholder database/auth configuration. No real database credentials are used for that build.
- No fresh Android binary or phone gameplay result is part of this change. The installed signed 0.2.0 build previously proved installation/launch only, not gameplay.

## Remaining gates and limits

- Independent review of this exact combined candidate is required.
- Real Prisma/PostgreSQL concurrent different-puzzle awards, season creation and repeat legacy catch-up passed in a temporary QA schema on the approved isolated Neon branch. The harness sets transaction-local search_path because Prisma schema configuration does not direct raw SQL. Original public table counts and row digests were unchanged and the QA schema was removed. This does not prove the production transaction wrapper with a nonpublic schema, OIDC or Android gameplay.
- Guest IDs remain self-asserted bearer identifiers. No account-grade identity, anti-cheat, rate limiting or historical score-cleanup claim is made.
- Real Neon OIDC is untested. No new auth-provider or secret configuration was made.
- Production database identity is not proven from an owning source. Puzzle-ID correlation does not prove it.
- Vercel root directory/production settings remain unverified. Root workspace CI and removing the nested lockfile do not establish Vercel's live configuration.
- Production migration, resource/backup creation, deploy/environment changes, release/tag/Play writes and public binaries remain on hold. This file grants no authority.
- The isolated test branch from earlier work auto-deletes November 8, 2026 at 19:49 IST. Do not rely on it after expiry or recreate it without authority.

## Migration/deployment order, only after separate approval

1. Confirm exact owning production target and explicit owner authority for each production action and any backup resource. Record current diagnostics; do not infer current row counts from old notes.
2. Re-review this candidate and qualify the transaction path on the isolated test branch.
3. Apply the additive migration before the route is deployed. Old code remains compatible but continues writing NULL keys during the window.
4. Verify unchanged row counts and valid index, then deploy only with separate approval.
5. The legacy-identity reader covers window rows immediately; repeat the conflict-safe backfill afterward if approved. It does not rewrite old score totals.
6. Test /api/progress and Android gameplay against the intended server. A local build or fake API emulator test is insufficient.
7. Rollback application deployment first; only then consider dropping the index/column with explicit authority. Never drop the column while this route is live.

## Local review delta after ef6a6239

The web CI file was present locally but omitted from ef6a6239 because .github is ignored. It is now explicitly included in the candidate tree with root package/lock path filters, full 30-test execution and a production-build job. It has not been pushed or run on GitHub. All actual CI claims remain conditional on a future authorized push/PR.

## Local PR27 integration after remote changes

Observed PR27 head819910577947dc107838a2f6678c4d138ba57b56 and main0f68dbb21da9d74e64405e457a9e9ccc30bc0609 are both preserved as local merge parents. Incoming Sentry/error-boundary/client instrumentation and malformed-JSON handling are retained, along with its additional progress-mapper tests. The root error screen uses self-contained critical inline styling after standalone visual inspection showed its Tailwind-only paragraph nearly invisible. This does not claim an induced Next.js root-layout failure test: visuals render the exact component through React SSR at desktop and mobile sizes. Resume and409-resync visuals use local mocked API responses and block external traffic.

Proposed apps/web/vercel.json disables Git auto-deployments for exactly fix/android-progress-api-20261107; other branches are unchanged. This has not been pushed or observed effective. Existing previews are not removed or made safe by it. Production+Preview currently share DATABASE_URL, so no preview gameplay is authorized. Vercel Root Directory apps/web was verified in owning settings. The malformed ignored-build command has not been changed.

No production database identity, migration/deploy authority, OIDC or Android gameplay clearance follows from this integration. A fresh remote comparison, exact independent review and meaningful account-use heads-up are required before any normal FF push. Do not use intermediate per-file pushes.

## Bundled-module binding regression corrected

The first combined production build exited0 but emitted an attempted-import warning: the preserved incoming progressService.mjs shadowed progressService.ts in webpack. That candidate was blocked before push. Renamed the preserved incoming mapper and declarations to progressSnapshot.mjs / progressSnapshot.d.mts and updated its four tests without changing mapper content.

CI now runs scripts/build-verified.mjs: a nonzero build or any compile/import/export warning fails the job even when Next exits0. A local negative fixture verified that attempted-import diagnostics with exit0 are rejected. The corrected production build completed with no compile/import/export warnings.

CI also starts the actual production bundle with a test-only Prisma preload and requests valid published progress for open and solved players. It asserts HTTP200, clue2, scores0/80, answer hiding/reveal and private,no-store. This test does not mock buildProgress or route modules; it replaces the external Prisma boundary only, confines the server to loopback with a nonexistent database URL, and blocks external HTTPS/fetch. It would fail500 if buildProgress were unresolved. It is module-binding/HTTP proof, not live PostgreSQL, OIDC, real-account or phone gameplay proof.
