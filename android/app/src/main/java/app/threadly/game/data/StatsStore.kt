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
            try { prefs.edit().putString(KEY, value)
                .putString("commit_nonce", java.util.UUID.randomUUID().toString()).commit() } catch (_: Exception) { false }
    }

    internal class StoreException(message: String) : Exception(message)

    /**
     * Empty list when nothing is stored. Throws StoreException when stored data is
     * unreadable OR semantically invalid (for example an impossible day): one bad
     * record makes the whole history fail-closed, never silently dropped or wiped.
     */
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
                ).also { r ->
                    // date math is pure arithmetic: an absurd day computes garbage
                    // silently, so validate semantics, not just shape
                    if (!valid(r)) throw StoreException("unreadable history")
                }
            }
        } catch (e: StoreException) {
            throw e
        } catch (e: Exception) {
            throw StoreException("unreadable history")
        }
    }

    /**
     * First result per puzzleId wins. Always recommit duplicate history, including
     * on a new StatsStore instance: SharedPreferences may still contain a failed
     * write in process memory. A changing nonce in the same editor forces a real
     * commit even on Android versions that skip unchanged values.
     */
    fun tryRecord(result: GameResult): Boolean {
        if (!valid(result)) return false
        val current = try { results() } catch (_: StoreException) { return false }
        return commit(if (current.any { it.puzzleId == result.puzzleId }) current else current + result)
    }

    private fun valid(r: GameResult): Boolean = r.puzzleId.isNotBlank() &&
        LocalStats.isValidIsoDay(r.day) && r.cluesUsed in 1..5 &&
        (if (r.solved) r.score == 120 - r.cluesUsed * 20 else r.score == 0)

    private fun commit(records: List<GameResult>): Boolean {
        val arr = JSONArray()
        records.forEach { r ->
            arr.put(JSONObject()
                .put("puzzleId", r.puzzleId)
                .put("day", r.day)
                .put("solved", r.solved)
                .put("cluesUsed", r.cluesUsed)
                .put("score", r.score))
        }
        return try { kv.write(arr.toString()) } catch (_: Exception) { false }
    }

    /**
     * Never throws: unreadable or semantically corrupt history (for example an
     * impossible day that breaks date math) degrades to an empty summary. This is
     * called directly from composition, so no exception type may escape.
     */
    fun summary(today: String): StatsSummary = try {
        LocalStats.summarize(results(), today)
    } catch (_: Exception) {
        StatsSummary(0, 0, 0, 0, emptyMap())
    }

    private companion object {
        const val KEY = "results_v1"
    }
}
