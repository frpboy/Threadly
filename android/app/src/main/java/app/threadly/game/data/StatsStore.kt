package app.threadly.game.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * SharedPreferences persistence for local game stats. Plain history, not a
 * credential, so it stays outside the keystore. Follows the OnboardingStore
 * contract: writes report failure and callers degrade, never assume saved.
 * Unreadable existing data makes [tryRecord] fail closed instead of wiping
 * the player's history.
 */
class StatsStore(context: Context) {
    private val prefs = context.getSharedPreferences("threadly_stats", Context.MODE_PRIVATE)

    /** Empty list when nothing is stored. Throws when stored data is unreadable. */
    fun results(): List<GameResult> {
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        val arr = JSONArray(raw)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            GameResult(
                puzzleId = o.getString("puzzleId"),
                day = o.getString("day"),
                solved = o.getBoolean("solved"),
                cluesUsed = o.getInt("cluesUsed"),
                score = o.getInt("score"),
            )
        }
    }

    /**
     * Records a finished game. First result per puzzleId wins (the server
     * finalizes a daily game once). Returns false without writing when the
     * existing history is unreadable or the commit fails.
     */
    fun tryRecord(result: GameResult): Boolean = try {
        val current = results()
        if (current.any { it.puzzleId == result.puzzleId }) {
            true // already recorded; a resume or replay is not a new outcome
        } else {
            val arr = JSONArray()
            (current + result).forEach { r ->
                arr.put(JSONObject()
                    .put("puzzleId", r.puzzleId)
                    .put("day", r.day)
                    .put("solved", r.solved)
                    .put("cluesUsed", r.cluesUsed)
                    .put("score", r.score))
            }
            prefs.edit().putString(KEY, arr.toString()).commit()
        }
    } catch (_: Exception) {
        false
    }

    fun summary(today: String): StatsSummary = try {
        LocalStats.summarize(results(), today)
    } catch (_: Exception) {
        StatsSummary(0, 0, 0, 0, emptyMap())
    }

    private companion object {
        const val KEY = "results_v1"
    }
}
