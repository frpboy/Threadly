# Threadly Android: connected client and loopback QA

Kotlin/Jetpack Compose client, namespace `app.threadly.game`, application ID `com.frpboy.threadly`, version0.2.0, minimum API24, target/compile API36. Android Gradle plugin8.13.2, Kotlin2.1.21 and Gradle8.14.3 are used in CI.

## Build types on this branch

- Normal debug/release: HTTPS API base `https://threadly-ruddy.vercel.app`. The current deployed backend is NOT qualified for this continuation. Compiling the normal client is not a working-phone claim. Release signing activates only with private environment configuration; keys/passwords must never be committed.
- `qa`: separate package `com.frpboy.threadly.qa`, exact device-loopback `http://127.0.0.1:8765`, with cleartext allowed only for127.0.0.1. CI restricts the installed target UID's IPv4+IPv6 egress, not the host or adbd. No live/admin/production credentials go to the app.
- The offline `phoneTest` sample is on a separate branch and is documented in PR28. That variant does not exist here and is not the connected full game.

## API and identity

The client calls real `/api/daily`, `/api/progress` and `/api/guess` routes. The server owns clue progression, score and finished state. The client ignores client-side score authority and refreshes after200/409. Guest IDs are self-asserted anonymous bearer identifiers, not verified accounts; knowing one can grant access to its progress. Account sign-in and a safe phone-accessible isolated backend remain unfinished.

Guess POST is not automatically retried by the proposed HTTP correction because it might already have committed before the response failed. Fixed-length streaming makes the body one-shot on the tested desktop JVM; actual Android transport checks are part of the new qualification, not assumed. Server per-attempt idempotency and manual uncertain-result resubmission remain separate design work. Daily/progress reads can retry once. Malformed typed successful responses become recoverable IO errors, not unchecked JSON exceptions.

## Commands and evidence

```sh
gradle -p android -PthreadlyTestBuildType=qa :app:testQaUnitTest :app:assembleQa :app:assembleQaAndroidTest --no-daemon
```

Prior source06d85 passed21JVM+4native actual Next/PostgreSQL checks in run42400540649. Current local HTTP candidate adds3JVM cases: original3RED, corrected desktop-JVM24GREEN using the exact Kotlin2.1.21 compiler. This is not an Android Gradle/API36 runtime result. New qualification workflows must discover exactly24JVM cases,8native synthetic-HTTP cases+7fake-API UI cases, and4actual-Next/PostgreSQL native cases. A future workflow success is required before these new counts are called device-qualified.

The real-server workflow creates an empty disposable local PostgreSQL database, applies the reviewed draft index only there, builds actual Next, tests native gameplay and exact SQL poststate, then removes its owned container and private credential files. The synthetic-loopback workflow deliberately uses a local fixture, not real cloud backend/provider evidence. Named resume/solved/exhausted screenshots must be inspected separately; green XML does not establish visual correctness.

Artifacts are bounded to named synthetic captures, crash text and test XML, not APKs, keystores, environment files or Gradle internals. Existing installed offline user data is untouched. A new signing certificate cannot upgrade an old installation; do not uninstall or clear data as a routine test workaround.
