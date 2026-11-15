package app.threadly.game

import app.threadly.game.data.GameResult
import app.threadly.game.data.ShareCard
import org.junit.Assert.*
import org.junit.Test

class ShareCardTest {

    @Test fun solvedCardShowsGreenForCluesUsedThenWhite() {
        val card = ShareCard.build(GameResult("p1", "2026-11-15", true, 2, 80))
        assertEquals("Threadly 2026-11-15\n🟩🟩⬜⬜⬜\nSolved in 2 clues - 80 points", card)
    }

    @Test fun firstClueSolveUsesSingular() {
        val card = ShareCard.build(GameResult("p1", "2026-11-15", true, 1, 100))
        assertTrue(card.contains("🟩⬜⬜⬜⬜"))
        assertTrue(card.contains("Solved in 1 clue - 100 points"))
    }

    @Test fun failedCardIsAllRedWithNoScore() {
        val card = ShareCard.build(GameResult("p1", "2026-11-15", false, 5, 0))
        assertEquals("Threadly 2026-11-15\n🟥🟥🟥🟥🟥\nOut of clues", card)
    }

    @Test fun cardNeverLeaksAnswerCluesOrGuesses() {
        val card = ShareCard.build(GameResult("p1", "2026-11-15", true, 3, 60))
        assertFalse(card.contains("Batman", ignoreCase = true))
        assertFalse(card.contains("answer", ignoreCase = true))
    }

    @Test fun blockRowAlwaysHasTotalClueCount() {
        for (clues in 1..5) {
            val card = ShareCard.build(GameResult("p1", "2026-11-15", true, clues, 100), totalClues = 5)
            val row = card.lines()[1]
            assertEquals(5, row.codePointCount(0, row.length))
        }
    }
}
