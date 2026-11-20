# Player data deletion — operator runbook

The privacy page and the Play data-safety form promise deletion via email to frpboy12@gmail.com.
Threadly stores no email, name or account for guest play, so a deletion request can only be
matched to server rows through the player's own identifier. This runbook makes that promise
operable.

## What identifies a player

| Client | Identity | Where the player sees it | Proof for deletion |
| --- | --- | --- | --- |
| Web guest | 36-char UUID, generated in the browser, kept only in localStorage (`threadly_guest_id`) | Home page footer, "Your player ID" (copy button) | The id itself: random, never in URLs/logs, known only to that browser |
| Native app | `dev-<48 hex>` issued at open enrollment | Top of the game screen, "Player ID" (copy button) | The device credential (Bearer token), even when expired or past its request cap; the server deletes the identity's rows and removes the credential row in one transaction |

## Self-serve routes (preferred)

- Web: stats screen -> "Delete my data" -> sends `DELETE /api/player-data` with `{guest_id, confirm: true}`.
- Native: game screen -> "Delete my data" -> sends `DELETE /api/player-data` with the device credential;
  the server deletes the identity's rows (including idempotency receipts) and removes the
  device row in ONE transaction, serialized against in-flight gameplay by advisory locks, so a
  failure leaves everything untouched and the request can simply be retried. An expired or
  request-capped credential still works for deletion (never for gameplay). After confirmation
  the app wipes its local state (credential, player ID, on-device stats, pending guess).

## Email requests (manual path)

1. Reply asking the player for their player ID (stats screen -> "Your player ID"), and whether
   they play on web, the app, or both.
2. Verify the shape: a 36-char UUID (web) or `dev-` + 48 hex (native). No other format exists.
3. Delete with the parameterized statements below against the production database, then record
   the affected-row counts for the reply.

```sql
BEGIN;
-- serialize against in-flight gameplay for this identity (same locks the app takes):
SELECT pg_advisory_xact_lock(hashtextextended('threadly:beta-request:' || $1, 0));
SELECT pg_advisory_xact_lock(hashtextextended('threadly:award:g:' || $1, 0));
DELETE FROM guesses               WHERE guest_id = $1;
DELETE FROM streaks               WHERE guest_id = $1;
DELETE FROM stats                 WHERE guest_id = $1;
DELETE FROM leaderboard_entries   WHERE guest_id = $1;
DELETE FROM threadly_guess_receipt WHERE guest_id = $1;
-- native devices only (self-deletion removes the row; `revoked` is for abuse action only):
DELETE FROM threadly_open_device  WHERE guest_id = $1;
COMMIT;
```

4. Tell the player to also clear site data / reinstall the app, which wipes the on-device copy.
5. Crash reports in Sentry contain no player ID (org rule: no IP storage; SDK sends no PII),
   so no Sentry action is needed.

## What cannot be done

- A request that only says "delete my data" with no player ID identifies nothing: no email or
  name is stored, so there is no lookup key. Always ask for the player ID.
- Never delete by fuzzy match (time windows, approximate ids). One exact id, one transaction,
  recorded counts.

## Retention

- Self-deletion retains nothing for the identity: device row, gameplay rows and receipts all go
  in the same transaction. The `revoked` flag on threadly_open_device exists only for
  administrative abuse revocation.
- Automatic purge: each open enrollment runs a capped batch purge. A credential lives
  90 days, then has a 30-day grace during which the expired credential can still
  self-delete; after that the identity AND all its data (device row, guesses, streaks,
  stats, leaderboard entries, receipts) are deleted automatically in one transaction.
  No gameplay data strands and no operator cleanup is needed.
- Concurrency: gameplay transactions take the player-scoped advisory lock
  (`threadly:award:<playerKey>`) before any read/write, and deletions take the same
  lock, so a same-browser concurrent guess + delete fully serialize - the outcome is
  always one of the two serial orders, never an interleave.
