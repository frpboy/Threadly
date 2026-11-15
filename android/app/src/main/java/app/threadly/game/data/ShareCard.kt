package app.threadly.game.data

/**
 * Spoiler-free share card (PRD V1). Contains the puzzle day, block pattern and
 * score only - never the answer, clues or guesses.
 */
object ShareCard {
    fun build(result: GameResult, totalClues: Int = 5, day: String? = result.day): String {
        val blocks = if (result.solved) {
            "🟩".repeat(result.cluesUsed.coerceIn(1, totalClues)) +
                "⬜".repeat((totalClues - result.cluesUsed).coerceAtLeast(0))
        } else {
            "🟥".repeat(totalClues)
        }
        val detail = if (result.solved) {
            val clueWord = if (result.cluesUsed == 1) "clue" else "clues"
            "Solved in ${result.cluesUsed} $clueWord - ${result.score} points"
        } else {
            "Out of clues"
        }
        val head = if (day != null) "Threadly $day" else "Threadly" // no fabricated date when the server day is unknown
        return "$head\n$blocks\n$detail"
    }
}
