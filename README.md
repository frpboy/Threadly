# Threadly

Threadly is a five-clue daily word puzzle. This repository contains the Next.js web application and backend in `apps/web`, plus a Kotlin/Jetpack Compose Android client in `android`.

## Current status

The server continuation implements server-authoritative guessing and `POST /api/progress`. It reconstructs progress from stored guesses, hides unfinished answers, and uses transactional scoring with per-clue uniqueness when its required partial database index is installed. That constraint is not durable per-request idempotency: retrying a committed wrong guess after losing its response can otherwise consume the next clue. These changes are under review in [PR #27](https://github.com/frpboy/Threadly/pull/27); their presence on a branch does not mean the public deployment has them.

PR #27 head `06fc862988409f42f2124a941bc1a7bb7151dab9` at this checkpoint passed 24 JVM tests and four native integration tests against an actual built Next.js server and a disposable PostgreSQL database in [run 42436508872](https://github.com/frpboy/Threadly/actions/runs/42436508872/job/128597293927). Its separate synthetic Android workflow failed before native tests at `adb root` ([run 42436508860](https://github.com/frpboy/Threadly/actions/runs/42436508860/job/128596392863)); the cause remains unknown, and its 15 native cases are not qualified on that head. A separate offline test package exercises one fixed sample. The offline package is **not** the live application. Account sign-in, a phone-accessible isolated backend, and a complete connected test APK are not yet qualified.

Guest identifiers in this implementation are self-asserted bearer identifiers, not verified accounts. Knowing another guest's identifier can grant access to that guest's progress. Do not use this as an account-security guarantee or a production release qualification.

The historical [server readiness notes](docs/THREADLY-SERVER-READINESS.md) describe earlier checkpoints and are not a current deployment clearance. Android documentation correction is tracked in [PR #28](https://github.com/frpboy/Threadly/pull/28), stacked on the separate phone-test branch. Keep branch-specific evidence separate from the phone-test sample and from local idempotency protocol experiments.

## Repository map

- `apps/web/app`: web pages and Next.js API routes.
- `apps/web/services`: puzzle validation, authoritative progress, scoring and transactional guess processing.
- `apps/web/prisma`: database schema and a separately reviewed draft migration.
- `android/app`: Android application and tests.
- `android/qa`: disposable database/server lifecycle and Android QA helpers.
- `docs`: product, architecture and operational notes. Older design documents may describe planned rather than implemented features.

## Web development

Use Node.js 24 and the root npm lockfile:

```sh
npm ci --workspace apps/web
npm run dev
```

The web workspace needs a PostgreSQL `DATABASE_URL` and server-only authentication configuration. Keep secrets outside source control. Use an isolated development database, never an inherited production connection for testing. The current Neon OIDC configuration is not a working sign-in setup merely because an issuer URL is present: client registration, discovery and callback behavior need verification.

```sh
npm test --workspace apps/web
node --test apps/web/tests/progress-service.test.mjs
cd apps/web && node scripts/build-verified.mjs
```

A build validates compilation, not database readiness or real-provider sign-in. The build verifier rejects compile/import/export warnings even when the compiler exits zero.

## Database safety

`prisma/schema.prisma` alone does not express the partial unique replay-protection index. Read [migration guidance](docs/20-database-migrations.md) and the draft SQL before preparing any deployment. Diagnose the exact target and preserve existing rows. Do not run `prisma db push`, migration scripts or synthetic fixture seeding against production.

Preview deployments are not automatically isolated: verify their database and authentication targets before gameplay. A Preview and Production environment label can still refer to the same database.

## API contract

The Android client uses:

- `GET /api/daily`: spoiler-free puzzle and first clue.
- `POST /api/progress`: current player's unlocked clues, guesses and finished result.
- `POST /api/guess`: server-derived clue consumption and score, followed by progress resynchronization.

The web client additionally uses `POST /api/clue`. Clue access must agree with authoritative progress, including after a solve. Client-supplied scores or clue counts are not authority. Direct leaderboard score submissions are disabled in the continuation.

## Android and releases

Production, loopback QA and offline phone testing have different purposes and live on different branches. PR #27 contains the connected client and loopback QA; PR #28 documents the separate phone-test branch. Use build instructions matching the exact checked-out source, not a different branch's variant list. Do not put backend credentials, signing keys or administrator secrets in an APK.

A different signing certificate cannot upgrade an existing installation. Preserve installed data and do not uninstall or clear data as a routine testing workaround. No Play Store or stable production release is claimed here.

## Contributing and support

Use focused changes with regression tests and review the complete diff before merging. Report reproducible problems through the repository's issues, without secrets or private player history.

[Buy Me a Coffee](https://www.buymeacoffee.com/frpboy)
