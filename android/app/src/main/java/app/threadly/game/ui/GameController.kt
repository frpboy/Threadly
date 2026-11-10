package app.threadly.game.ui

import app.threadly.game.data.GameApi
import app.threadly.game.data.GameState
import app.threadly.game.data.Progress
import java.io.IOException
import app.threadly.game.data.PendingGuessException
import app.threadly.game.data.AccessDeniedException

sealed interface UiState {
    data object Loading : UiState
    data class Error(val message: String) : UiState
    data class Playing(
        val puzzleId: String, val title: String, val progress: Progress,
        val notice: String = "", val submitting: Boolean = false,
    ) : UiState
    data class Finished(val puzzleId: String, val title: String, val progress: Progress, val notice: String) : UiState
}

/** Pure game flow over [GameApi]. The server is the only source of truth for clues, guesses, score and finish state. */
class GameController(private val api: GameApi, private val guestId: String) {

    suspend fun load(): UiState = try {
        val daily = api.daily() ?: return UiState.Error("Couldn't load today's puzzle. Try again.")
        val p = api.progress(daily.puzzleId, guestId)
            ?: return UiState.Error("Couldn't load your progress. Try again.")
        render(daily.puzzleId, daily.title, p, "")
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
                    render(current.puzzleId, current.title, p, notice)
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

    private fun render(id: String, title: String, p: Progress, notice: String): UiState =
        if (p.finished) UiState.Finished(id, title, p, finishedMessage(p))
        else UiState.Playing(id, title, p, notice)

    companion object {
        fun finishedMessage(p: Progress): String = when (p.state) {
            GameState.SOLVED -> "Correct! +${p.score} points. Answer: ${p.answer}"
            GameState.EXHAUSTED -> "Out of clues. The answer was: ${p.answer}"
            GameState.OPEN -> ""
        }
    }
}
