# Account attempt route qualification fixtures

These tests import the real exported Next POST handler and Next request/response types. Only auth callback and database target are substituted using an explicit test loader. This is not provider sign-in, JWT revocation, Next middleware, built-server or Android qualification.

Run only in the owned isolated PostgreSQL harness: no external network, a new empty cluster with Unix socket `/work`, database `threadly_integration_owned`, generated Prisma5.22 client at `/work/generated-client`, existing read-only dependencies mounted at `/modules`, current schema initialized, and the existing guess-player-key draft applied only to that empty database. The test creates the additive receipt table itself and fails if already present. Never point it at a shared or production database.

The targeted invocation inside that prepared environment is:

```sh
node --max-old-space-size=256 --experimental-strip-types --experimental-loader ./apps/web/tests/attempt-v2/loader.mjs --test ./apps/web/tests/attempt-v2/route-owned-pg.test.mjs
```

These files do not provision a cluster or collect credentials. Test configuration uses a clearly synthetic revision key and `.invalid` account/origin fixtures. The loader is qualification-only and must never replace production authentication. Normal application builds do not import it.

At the November8 checkpoint, the precursor exact-source harness passed8cases+wrapper (9TAP): identity/config/Origin failures; body limits+5s408/noanswer; wrongguess replay/conflict/stale; cross-account PROGRESS isolation; committed solve/HTTPreset/replay; pause-controlled puzzle+clueedit blocking; hide-before-replay404; hiddenreceipt404. The checked-in path adaptations are not a separate executed result. Current-account absence coverage is PROGRESS only, not deleted-account replay/delete-lock. New clue inserts, legacy writers and actual provider/native clients remain outside this scope.
