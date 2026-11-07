# Threadly Android (Kotlin + Jetpack Compose) - local prototype

Status: debug build only. Never run on a device or emulator. applicationId app.threadly.game is a PLACEHOLDER.
Backend: existing Next.js API (public player endpoints only): /api/daily, /api/progress, /api/guess. No admin routes, no secrets.
The server decides clues, guesses, score and finished state. The client never sends a clue count.
Tests: `gradle testDebugUnitTest` (18 JVM tests: progress parsing, 409 resync, HTTP retry rules).
The earlier Java Views prototype is kept separately as reference only.
