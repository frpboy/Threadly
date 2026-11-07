package app.threadly.game

import app.threadly.game.data.*

/** Fixed local sample only. No server, account, leaderboard or production data. */
class OfflineGameApi(initial: List<String> = emptyList(), private val save: (List<String>) -> Unit = {}) : GameApi {
    private val guesses = initial.take(5).toMutableList()
    private val clues = listOf("Wears a cape", "A detective", "Lives in Gotham", "Has a Batmobile", "Bruce Wayne")
    override suspend fun daily() = Daily("offline-sample", "Offline sample", 5)
    override suspend fun progress(puzzleId: String, guestId: String): Progress {
        val solved = guesses.lastOrNull()?.equals("Batman", ignoreCase = true) == true
        val state = if (solved) GameState.SOLVED else if (guesses.size == 5) GameState.EXHAUSTED else GameState.OPEN
        val count = if (solved) guesses.size else minOf(guesses.size + 1, 5)
        return Progress(state, count, clues.take(count), guesses.toList(), 5,
            if (solved) 120 - 20 * count else 0, if (state != GameState.OPEN) "Batman" else "")
    }
    override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome {
        if (progress(puzzleId, guestId).finished) return GuessOutcome(409)
        val value = text.trim().take(200)
        if (value.isBlank()) return GuessOutcome(400)
        guesses += value
        save(guesses.toList())
        return GuessOutcome(200)
    }
}
