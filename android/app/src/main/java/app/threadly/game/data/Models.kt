package app.threadly.game.data

import org.json.JSONException
import org.json.JSONObject

enum class GameState { OPEN, SOLVED, EXHAUSTED }

/** Server-authoritative state from POST /api/progress. */
data class Progress(
    val state: GameState,
    val clueNumber: Int,
    val clues: List<String>,
    val guesses: List<String>,
    val totalClues: Int,
    val score: Int,
    val answer: String,
) {
    val finished: Boolean get() = state != GameState.OPEN

    companion object {
        @Throws(JSONException::class)
        fun parse(j: JSONObject): Progress {
            val state = when (val s = j.getString("state")) {
                "open" -> GameState.OPEN
                "solved" -> GameState.SOLVED
                "exhausted" -> GameState.EXHAUSTED
                else -> throw JSONException("unknown state $s")
            }
            val cs = j.getJSONArray("clues")
            val clues = (0 until cs.length()).map { cs.getJSONObject(it).getString("text") }
            val gs = j.optJSONArray("guesses")
            val guesses = if (gs == null) emptyList() else (0 until gs.length()).map { gs.getString(it) }
            val finished = state != GameState.OPEN
            return Progress(
                state = state,
                clueNumber = j.getInt("clue_number"),
                clues = clues,
                guesses = guesses,
                totalClues = j.optInt("total_clues", 5),
                score = j.optInt("score_awarded", 0),
                // never trust or show an answer while the game is still open
                answer = if (finished) j.optString("answer", "") else "",
            )
        }
    }
}

data class Daily(val puzzleId: String, val title: String, val totalClues: Int)

/** HTTP status of /api/guess. 200 = scored or wrong, 409 = replay/already solved/exhausted. */
data class GuessOutcome(val httpCode: Int)
