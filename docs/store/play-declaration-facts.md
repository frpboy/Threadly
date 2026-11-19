# Threadly Play declaration fact sheet (DRAFT, internal)

Grounded in source at 83c69e0 and the published android-v0.2.1-beta.3 APK
(SHA256 00881bed38c96ab994f794597e1071738dba166faace999546f76ffeb4ffef11),
manifest re-inspected 2026-11-18. Not yet entered in any Console.

## App identity
- Package: com.frpboy.threadly (permanent once uploaded to Play)
- versionCode 4 / versionName 0.2.1-beta.3; minSdk 24; targetSdk 36; compileSdk 36
- Signing: permanent dedicated key, cert SHA-256 3c43ac6837a47eabeb06bc67948526c029031eb3fa26ac1b0ada28592ad4df03, held in the Instinct vault. Play App Signing enrollment: NOT done, separate owner decision.

## Permissions / manifest
- Only android.permission.INTERNET (plus own dynamic-receiver permission)
- No AD_ID, no location, no camera/mic, no contacts, no accounts
- allowBackup=false, usesCleartextTraffic=false, dataExtractionRules present
- No ads SDK of any kind

## Data flows (for Data safety draft)
1. Gameplay: guesses and results go over HTTPS to the developer's own backend
   (scoring is server-side by design). Stats and streaks are also stored on
   device. No account, no email, no name. Device is identified by an
   app-generated credential (DeviceCredentials, Android Keystore alias
   "threadly-native-beta-device-v1" in beta; production alias TBD).
2. Crash reporting: Sentry (Functional Software, Inc.), io.sentry:sentry-android:8.64.0.
   - Release builds (including the published beta.3) carry a live DSN via
     manifest meta-data; SDK auto-inits (SentryInitProvider present).
   - send-default-pii = false; user-interaction breadcrumbs disabled by design
     so Compose semantics text (e.g. guess field) does not leave the device.
   - Default Sentry Android event fields still apply: device model, OS version,
     app version, architecture, memory/battery state, stack traces.
   - OPEN: Sentry project-side "prevent storing IP addresses" setting is
     unverified; server-side IP handling unknown.
   - OPEN: no user-facing privacy policy exists yet; Play requires one
     (Data safety + Sentry both make this irreducible).
3. Nothing else leaves the device. No analytics SDK besides Sentry, no
   third-party ad or tracking network.

## Declaration sketch (to verify against the final shipping build)
- Ads declaration: no ads.
- Advertising ID: not used (no AD_ID permission).
- Sign-in details: no login required for any feature.
- Target audience / content rating: owner judgment, but content is a
  family-safe daily word puzzle (content guidelines doc 14 excludes
  political/religious/offensive material).
- Data safety: collect (a) app activity - guesses/results, sent to own server,
  not shared; (b) app info and performance - crash logs + diagnostics via
  Sentry, shared with Sentry as processor. Both encrypted in transit (HTTPS,
  cleartext disabled). Data deletion: no account exists; device data clears on
  uninstall (allowBackup=false). Server-side per-device records deletion path:
  OPEN (needs a documented request route, likely via privacy policy contact).

## Build-time backend configuration
- API base is a build-time field: -PthreadlyBetaApiBase=https://host
  (BuildConfig.API_BASE). Release builds refuse to build without it
  (Gradle guard). https://threadly-ruddy.vercel.app is explicitly rejected as
  a beta target by the same guard.
- beta.3 was built pointing at the temporary threadly-native-beta.vercel.app,
  deleted 2026-11-16: that artifact cannot power any store release. A store
  build = same source, new -PthreadlyBetaApiBase value once the production
  host decision lands; no app-code change needed.

## Known holds
- Old 0.2.0 APK (versionCode 1) quarantined: Drive flagged it, exact-bytes/
  signer match is not malware clearance; upgrade-path QA unresolved. Play
  upload should start at versionCode >= 5 for any store build to stay clear
  of both 0.2.0 (vc1) and beta line (vc2-4) ambiguity.
- Functional qualification gaps: 30-day content pack, persistence/upgrade/
  offline behavior, all unproven beyond synthetic 5-clue smoke.
