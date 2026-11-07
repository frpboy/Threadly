# Threadly Android

Kotlin and Jetpack Compose client for the Threadly guessing game.

## Build variants

| Variant | Package | Data source | Purpose |
| --- | --- | --- | --- |
| `debug` / `release` | `com.frpboy.threadly` | Configured HTTPS Threadly API | Client development / future release. Live gameplay is not qualified by the local tests below. |
| `qa` | `com.frpboy.threadly.qa` | Device loopback `127.0.0.1:8765` | Disposable CI integration only. Requires its local server and port setup; not a phone download build. |
| `phoneTest` | `com.frpboy.threadly.test` | One fixed offline sample | Separate, debug-signed install for client testing. No Internet permission, account, live puzzle or server leaderboard. |

The release package is not a placeholder. Release signing is enabled only when the explicit keystore environment is configured. Do not use production signing keys for ordinary test builds.

## Offline phone test

`phoneTest` launches `OfflineTestActivity`, displays an offline-test banner and keeps sample guesses in its own private preferences. Reset sample clears only that sample. It uses the existing game UI and controller, but its local fixture is not evidence of a working live backend.

```sh
gradle -p android -PthreadlyTestBuildType=phoneTest \
  :app:testPhoneTestUnitTest :app:assemblePhoneTest :app:assemblePhoneTestAndroidTest
# With a disposable Android emulator running:
gradle -p android -PthreadlyTestBuildType=phoneTest :app:connectedPhoneTestAndroidTest
```

The phone variant currently has 23 JVM tests and 8 device tests, including the real offline launcher, saved progress after recreation, a correct guess, reset and five wrong guesses. The device test explicitly scrolls input and Guess into view before acting. This does not establish physical-gesture behavior or all screen sizes.

A debug APK signed with a new key cannot update an existing installation of the same test package. Record and compare the actual delivered APK's signer before promising an update. Do not ask a tester to uninstall merely to hide a signing mismatch.

## Server integration

The live client uses only public player endpoints: `/api/daily`, `/api/progress` and `/api/guess`. No admin routes or embedded secrets are needed. The server controls unlocked clues, guesses, score and finished state; the client never sends a clue count or trusted score. The anonymous guest ID is self-asserted, stored on device and is not an account or an authenticated identity.

The real-server QA workflow builds Next.js and starts an empty, owned, disposable PostgreSQL database on runner loopback. It uses fresh per-run credentials and removes its owned container and private credential files afterward. It does not test production, shared previews, Neon, Google sign-in or the owner's physical phone. No production migration is part of that workflow.

Canonical published puzzles require exactly five nonempty clues with distinct orders 1 through 5 and a nonempty answer. Short, duplicate-order and gapped published content is rejected before progress or scoring. The QA workflow retains malformed-content negative cases as well as the canonical game fixture.

## Verified checkpoints

- [Real Next/PostgreSQL integration](https://github.com/frpboy/Threadly/actions/runs/42400540649): 21 JVM tests and 4 native integration tests passed, nine malformed-content HTTP rejections passed, and database poststate checks confirmed eight canonical guesses with one 80-point award and no malformed-probe guesses.
- [Offline phone qualification](https://github.com/frpboy/Threadly/actions/runs/42406205383): 23 JVM tests and 8 device tests passed on the API 36 emulator. Open, solved and exhausted captures were inspected.

These are scoped test results, not production, Play, Google sign-in or full-device certification. The earlier Java Views prototype is reference only.

## Delivery

The phone-test workflow uploads an encrypted APK envelope, not a public plaintext APK. Its public recipient certificate is safe to commit; its temporary private delivery key must stay outside source, CI and artifacts. Verify the final post-instrumentation APK's actual package, permissions, signature and hash after decryption, then use private owner-only delivery. The connected test task can repackage the APK, so metadata recorded before that task is not proof of the final bytes.
