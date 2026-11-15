package app.threadly.game.data

import android.content.Context

/**
 * Plain first-run flag. Not a credential or request state, so it stays outside the
 * keystore; losing it only replays the how-to-play screens once.
 */
class OnboardingStore(context: Context) {
    private val prefs = context.getSharedPreferences("threadly_onboarding", Context.MODE_PRIVATE)

    fun isComplete(version: Int): Boolean = prefs.getInt("completed_version", 0) >= version

    /** Returns false when the write failed; callers must keep the flow visible and retry, never assume saved. */
    fun tryMarkComplete(version: Int): Boolean =
        try { prefs.edit().putInt("completed_version", version).commit() } catch (_: Exception) { false }
}
