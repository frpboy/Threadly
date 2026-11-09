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

PR #27 head `06fc862988409f42f2124a941bc1a7bb7151dab9` at this checkpoint passed24JVM+4actual-Next/PostgreSQL native checks in [run42436508872](https://github.com/frpboy/Threadly/actions/runs/42436508872/job/128597293927). SQL poststate and named synthetic gameplay captures were inspected separately. This is loopback QA, not provider sign-in or a production phone-backend result.

The separate synthetic-loopback workflow on the SAME source failed at `adb root` before native execution in [run42436508860](https://github.com/frpboy/Threadly/actions/runs/42436508860/job/128596392863). Its24JVM tests passed, but zero native cases ran there. The intended inventory remains8synthetic-HTTP+7fake-API UI cases; all15 are still unqualified on this head. The adb failure's cause is unknown. Do not count a workflow dispatch or JVM success as Android native qualification.

The real-server workflow creates an empty disposable local PostgreSQL database, applies the reviewed draft index only there, builds actual Next, tests native gameplay and exact SQL poststate, then removes its owned container and private credential files. The synthetic-loopback workflow deliberately uses a local fixture, not real cloud backend/provider evidence. Named resume/solved/exhausted screenshots must be inspected separately; green XML does not establish visual correctness.

Artifacts are bounded to named synthetic captures, crash text and test XML, not APKs, keystores, environment files or Gradle internals. Existing installed offline user data is untouched. A new signing certificate cannot upgrade an old installation; do not uninstall or clear data as a routine test workaround.
