package app.threadly.game.ui

import app.threadly.game.data.GameApi
import app.threadly.game.data.GameResult
import app.threadly.game.data.GameState
import app.threadly.game.data.Progress
import java.io.IOException
import java.util.Calendar
import java.util.TimeZone
import app.threadly.game.data.PendingGuessException
import app.threadly.game.data.AccessDeniedException

sealed interface UiState {
    data object Loading : UiState
    data class Error(val message: String) : UiState
    data class Playing(
        val puzzleId: String, val title: String, val puzzleDay: String, val progress: Progress,
        val notice: String = "", val submitting: Boolean = false,
    ) : UiState
    data class Finished(
        val puzzleId: String, val title: String, val puzzleDay: String, val progress: Progress, val notice: String,
        /** False only when a stats store exists but has not durably saved this result yet; a later render retries. */
        val statsSaved: Boolean = true,
    ) : UiState
}

/** Pure game flow over [GameApi]. The server is the only source of truth for clues, guesses, score and finish state. */
class GameController(
    private val api: GameApi,
    private val guestId: String,
    /** Local stats hook returning true only when the result is durably saved. Failures stay unrecorded so a later render retries; recording never breaks gameplay. */
    private val recorder: ((GameResult) -> Boolean)? = null,
    /** UTC date of play, ISO yyyy-MM-dd. Injectable for tests. Calendar, not java.time: minSdk 24 has no desugaring. */
    private val clock: () -> String = {
        val c = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
        "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
    },
) {
    private val recorded = HashSet<String>()

    suspend fun load(): UiState = try {
        val daily = api.daily() ?: return UiState.Error("Couldn't load today's puzzle. Try again.")
        val p = api.progress(daily.puzzleId, guestId)
            ?: return UiState.Error("Couldn't load your progress. Try again.")
        // The puzzle's own UTC day comes from the server; the device clock is only a
        // fallback for older servers, so a finish after midnight still records the
        // puzzle it actually belongs to.
        render(daily.puzzleId, daily.title, daily.publishedDate ?: clock(), p, "")
    } catch (e: AccessDeniedException) {
        UiState.Error("Beta access expired or was revoked. Use a new invitation to re-enroll.")
    } catch (e: IOException) {
        UiState.Error("No connection. Check your network and try again.")
    }

    suspend fun guess(current: UiState.Playing, text: String): UiState {
        val g = text.trim()
        if (g.isEmpty()) return current
        return try {
            val out = api.guess(current.puzzleId, guestId, g)
            when {
                out.httpCode == 200 || out.httpCode == 409 -> {
                    // 200: scored or wrong. 409: replay, already solved or out of guesses. Either way show the server's state.
                    val p = api.progress(current.puzzleId, guestId)
                        ?: return current.copy(notice = "Couldn't refresh. Try again.", submitting = false)
                    val notice = when {
                        out.httpCode == 409 && p.state == GameState.OPEN -> "Synced with your saved progress."
                        p.state == GameState.OPEN -> "Not quite. Here is another clue."
                        else -> ""
                    }
                    render(current.puzzleId, current.title, current.puzzleDay, p, notice)
                }
                else -> current.copy(notice = "Couldn't check that guess. Try again.", submitting = false)
            }
        } catch (e: AccessDeniedException) {
            UiState.Error("Beta access expired or was revoked. Use a new invitation to re-enroll.")
        } catch (e: PendingGuessException) {
            current.copy(notice = "Confirm your pending guess first: ${e.pendingGuess}", submitting = false)
        } catch (e: IOException) {
            current.copy(notice = "No connection. Try again.", submitting = false)
        }
    }

    private fun render(id: String, title: String, day: String, p: Progress, notice: String): UiState {
        if (p.finished && recorder != null && !recorded.contains(id)) {
            val saved = try {
                recorder.invoke(
                    GameResult(
                        puzzleId = id,
                        day = day,
                        solved = p.state == GameState.SOLVED,
                        cluesUsed = p.clueNumber,
                        score = p.score,
                    )
                )
            } catch (_: Exception) {
                false // stats are local; a failed record never changes the game state
            }
            // Mark only after a durable save: a failure stays pending and the next render retries.
            if (saved) recorded.add(id)
        }
        if (p.finished) {
            val statsSaved = recorder == null || recorded.contains(id)
            return UiState.Finished(id, title, day, p, finishedMessage(p), statsSaved)
        }
        return UiState.Playing(id, title, day, p, notice)
    }

    companion object {
        fun finishedMessage(p: Progress): String = when (p.state) {
            GameState.SOLVED -> "Correct! +${p.score} points. Answer: ${p.answer}"
            GameState.EXHAUSTED -> "Out of clues. The answer was: ${p.answer}"
            GameState.OPEN -> ""
        }
    }
}
