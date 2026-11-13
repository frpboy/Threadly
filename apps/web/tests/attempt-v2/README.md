# Account attempt route qualification fixtures

These tests import the real exported Next POST handler and Next request/response types. Only auth callback and database target are substituted using an explicit test loader. This is not provider sign-in, JWT revocation, Next middleware, built-server or Android qualification.

Run only in the owned isolated PostgreSQL harness: no external network, a new empty cluster with Unix socket `/work`, database `threadly_integration_owned`, generated Prisma5.22 client at `/work/generated-client`, existing read-only dependencies mounted at `/modules`, current schema initialized, and the existing guess-player-key draft applied only to that empty database. The test creates the additive receipt table itself and fails if already present. Never point it at a shared or production database.

The targeted invocation inside that prepared environment is:

```sh
node --max-old-space-size=256 --experimental-strip-types --experimental-loader ./apps/web/tests/attempt-v2/loader.mjs --test ./apps/web/tests/attempt-v2/route-owned-pg.test.mjs
```

These files do not provision a cluster or collect credentials. Test configuration uses a clearly synthetic revision key and `.invalid` account/origin fixtures. The loader is qualification-only and must never replace production authentication. Normal application builds do not import it.

At the November8 checkpoint, the precursor exact-source harness passed8cases+wrapper (9TAP): identity/config/Origin failures; body limits+5s408/noanswer; wrongguess replay/conflict/stale; cross-account PROGRESS isolation; committed solve/HTTPreset/replay; pause-controlled puzzle+clueedit blocking; hide-before-replay404; hiddenreceipt404. The checked-in path adaptations are not a separate executed result. The separate account-deletion test closes the deleted-account replay/delete-lock gap at the checkpoint below. New clue inserts, legacy writers and actual provider/native clients remain outside this scope.

At the later November8 checkpoint, the exact precursor of `account-deletion-owned-pg.test.mjs` passed2NEWcases+wrapper (3TAP) in one isolated actualPG14/Prisma5.22 run, with no repeat of the prior8cases. A committed receipt survives legitimate account-deletion FK effects, then same-key/new-key/progress requests return401 without changing the post-deletion DB baseline. Pause-controlled concurrent DELETE fails55P03 while the actual route holds FOR KEY SHARE; after release the solve commits100 once, deletion succeeds and replay returns401 without further writes. The fixture authentication callback is still not real OIDC/JWT-revocation proof. The checked-in relative-path adaptations are source-reviewed only, not a second executed result.

Use the same targeted invocation above with `account-deletion-owned-pg.test.mjs` instead of `route-owned-pg.test.mjs`, in a NEW empty isolated database. Do not glob both files together into one database: each intentionally creates the receipt table itself and must fail if it already exists.
