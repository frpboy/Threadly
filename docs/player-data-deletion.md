# Player data deletion — operator runbook

The privacy page and the Play data-safety form promise deletion via email to frpboy12@gmail.com.
Threadly stores no email, name or account for guest play, so a deletion request can only be
matched to server rows through the player's own identifier. This runbook makes that promise
operable.

## What identifies a player

| Client | Identity | Where the player sees it | Proof for deletion |
| --- | --- | --- | --- |
| Web guest | 36-char UUID, generated in the browser, kept only in localStorage (`threadly_guest_id`) | Home page footer, "Your player ID" (copy button) | The id itself: random, never in URLs/logs, known only to that browser |
| Native app | `dev-<48 hex>` issued at open enrollment | Stats screen, "Your player ID" | The live device credential (Bearer token); it revokes itself on deletion |

## Self-serve routes (preferred)

- Web: stats screen -> "Delete my data" -> sends `DELETE /api/player-data` with `{guest_id, confirm: true}`.
- Native: stats screen -> "Delete my data" -> sends `DELETE /api/player-data` with the device credential;
  the server deletes the identity's rows and revokes the credential.

## Email requests (manual path)

1. Reply asking the player for their player ID (stats screen -> "Your player ID"), and whether
   they play on web, the app, or both.
2. Verify the shape: a 36-char UUID (web) or `dev-` + 48 hex (native). No other format exists.
3. Delete with the parameterized statements below against the production database, then record
   the affected-row counts for the reply.

```sql
BEGIN;
DELETE FROM guesses             WHERE guest_id = $1;
DELETE FROM streaks             WHERE guest_id = $1;
DELETE FROM stats               WHERE guest_id = $1;
DELETE FROM leaderboard_entries WHERE guest_id = $1;
-- native devices only:
UPDATE threadly_open_device SET revoked = true WHERE guest_id = $1;
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
