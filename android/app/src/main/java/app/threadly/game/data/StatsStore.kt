package app.threadly.game.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * SharedPreferences persistence for local game stats. Plain history, not a
 * credential, so it stays outside the keystore.
 *
 * Contract: [tryRecord] returns true only after the value is durably committed.
 * It returns false - and loses nothing - when existing history is unreadable or
 * the commit fails; callers surface that as unsaved and may retry later.
 */
class StatsStore internal constructor(private val kv: KvStore) {

    constructor(context: Context) : this(SharedPrefsKv(context))

    /** Minimal key-value abstraction so commit failure and corruption are unit-testable. */
    internal interface KvStore {
        fun read(): String?
        /** Returns true only when the value is durably stored. */
        fun write(value: String): Boolean
    }

    private class SharedPrefsKv(context: Context) : KvStore {
        private val prefs = context.getSharedPreferences("threadly_stats", Context.MODE_PRIVATE)
        override fun read(): String? = prefs.getString(KEY, null)
        override fun write(value: String): Boolean =
            try { prefs.edit().putString(KEY, value).commit() } catch (_: Exception) { false }
    }

    internal class StoreException(message: String) : Exception(message)

    /** Empty list when nothing is stored. Throws StoreException when stored data is unreadable. */
    fun results(): List<GameResult> {
        val raw = try { kv.read() } catch (e: Exception) { throw StoreException("read failed: ${e.javaClass.simpleName}") }
        if (raw == null) return emptyList()
        try {
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
        } catch (e: Exception) {
            throw StoreException("unreadable history")
        }
    }

    /**
     * Records a finished game. First result per puzzleId wins (the server
     * finalizes a daily game once; a resume or replay is not a new outcome and
     * reports true without writing). Returns false without writing when the
     * existing history is unreadable or the commit fails.
     */
    fun tryRecord(result: GameResult): Boolean {
        val current = try { results() } catch (_: StoreException) { return false }
        if (current.any { it.puzzleId == result.puzzleId }) return true
        val arr = JSONArray()
        (current + result).forEach { r ->
            arr.put(JSONObject()
                .put("puzzleId", r.puzzleId)
                .put("day", r.day)
                .put("solved", r.solved)
                .put("cluesUsed", r.cluesUsed)
                .put("score", r.score))
        }
        return kv.write(arr.toString())
    }

    /** Never throws: an unreadable history degrades to an empty summary. */
    fun summary(today: String): StatsSummary = try {
        LocalStats.summarize(results(), today)
    } catch (_: StoreException) {
        StatsSummary(0, 0, 0, 0, emptyMap())
    }

    private companion object {
        const val KEY = "results_v1"
    }
}
