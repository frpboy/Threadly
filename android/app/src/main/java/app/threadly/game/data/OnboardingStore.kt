package app.threadly.game.data

import android.content.Context

/**
 * Plain first-run flag. Not a credential or request state, so it stays outside the
 * keystore; losing it only replays the how-to-play screens once.
 */
class OnboardingStore(context: Context) {
    private val prefs = context.getSharedPreferences("threadly_onboarding", Context.MODE_PRIVATE)

    fun isComplete(version: Int): Boolean = prefs.getInt("completed_version", 0) >= version

    fun markComplete(version: Int) {
        check(prefs.edit().putInt("completed_version", version).commit()) { "Could not save onboarding state" }
    }
}
