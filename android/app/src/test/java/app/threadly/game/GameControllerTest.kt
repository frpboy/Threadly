package app.threadly.game

import app.threadly.game.data.*
import app.threadly.game.ui.GameController
import app.threadly.game.ui.UiState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

private class FakeApi : GameApi {
    var progress: Progress = open(1)
    var guessCode = 200
    var failIo = false
    var progressNull = false
    var progressIoAfterGuess = false
    private var guessed = false
    val guessCalls = mutableListOf<String>()
    override suspend fun daily() = Daily("p1", "Puzzle", 5)
    override suspend fun progress(puzzleId: String, guestId: String): Progress? {
        if (failIo || (progressIoAfterGuess && guessed)) throw IOException("down"); return if (progressNull) null else progress
    }
    override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome {
        if (failIo) throw IOException("down"); guessCalls += text; guessed = true; return GuessOutcome(guessCode)
    }
}
private fun open(n: Int, guesses: List<String> = emptyList()) =
    Progress(GameState.OPEN, n, (1..n).map { "clue$it" }, guesses, 5, 0, "")
private fun solved(n: Int, score: Int) =
    Progress(GameState.SOLVED, n, (1..n).map { "clue$it" }, listOf("g"), 5, score, "Batman")
private fun exhausted() = Progress(GameState.EXHAUSTED, 5, (1..5).map { "clue$it" }, listOf("1", "2", "3", "4", "5"), 5, 0, "Batman")

class GameControllerTest {
    private val api = FakeApi()
    private val c = GameController(api, "guest")

    @Test fun loadResumesOpenGameFromServer() = runBlocking {
        api.progress = open(3, listOf("x", "y"))
        val s = c.load() as UiState.Playing
        assertEquals(3, s.progress.clues.size); assertEquals(listOf("x", "y"), s.progress.guesses)
    }
    @Test fun loadShowsFinishedGameWithoutAllowingGuesses() = runBlocking {
        api.progress = solved(2, 80)
        val s = c.load() as UiState.Finished
        assertTrue(s.notice.contains("+80")); assertTrue(s.notice.contains("Batman"))
    }
    @Test fun wrongGuessShowsNextClueFromServerProgress() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progress = open(2, listOf("x"))
        val s = c.guess(cur, "x") as UiState.Playing
        assertEquals(2, s.progress.clues.size); assertEquals("Not quite. Here is another clue.", s.notice)
        assertEquals(listOf("x"), api.guessCalls)
    }
    @Test fun correctGuessFinishesWithServerScore() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progress = solved(1, 100)
        val s = c.guess(cur, "batman") as UiState.Finished
        assertTrue(s.notice.contains("+100"))
    }
    @Test fun http409AlreadySolvedResyncsToFinished() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.guessCode = 409; api.progress = solved(3, 60)
        val s = c.guess(cur, "batman") as UiState.Finished
        assertEquals(GameState.SOLVED, s.progress.state)
    }
    @Test fun http409ExhaustedResyncsToFinished() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.guessCode = 409; api.progress = exhausted()
        val s = c.guess(cur, "again") as UiState.Finished
        assertTrue(s.notice.contains("Out of clues"))
    }
    @Test fun http409ReplayWhileStillOpenSyncsWithoutDoubleCounting() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.guessCode = 409; api.progress = open(2, listOf("x"))
        val s = c.guess(cur, "x") as UiState.Playing
        assertEquals("Synced with your saved progress.", s.notice); assertEquals(2, s.progress.clues.size)
    }
    @Test fun serverErrorKeepsStateAndAllowsRetry() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.guessCode = 500
        val s = c.guess(cur, "x") as UiState.Playing
        assertEquals(1, s.progress.clues.size); assertFalse(s.submitting); assertTrue(s.notice.contains("Try again"))
    }
    @Test fun networkDownOnGuessKeepsState() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.failIo = true
        val s = c.guess(cur, "x") as UiState.Playing
        assertTrue(s.notice.contains("No connection")); assertFalse(s.submitting)
    }
    @Test fun networkDownOnLoadIsRetryableError() = runBlocking {
        api.failIo = true
        assertTrue(c.load() is UiState.Error)
    }
    @Test fun blankGuessIsIgnored() = runBlocking {
        val cur = c.load() as UiState.Playing
        assertSame(cur, c.guess(cur, "   ")); assertTrue(api.guessCalls.isEmpty())
    }

    @Test fun refreshFailureAfterScoredGuessDoesNotUnlockOrAward() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progress = solved(1, 100)           // server did score it
        api.progressIoAfterGuess = true         // but the client cannot read the result
        val s = c.guess(cur, "batman") as UiState.Playing
        assertEquals(1, s.progress.clues.size)  // no clue unlocked from the client side
        assertEquals(0, s.progress.score); assertFalse(s.submitting)
        assertTrue(s.notice.contains("No connection"))
    }
    @Test fun retryAfterRefreshFailureResyncsToServerStateWithoutSecondAward() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progress = solved(1, 100); api.progressIoAfterGuess = true
        val after = c.guess(cur, "batman") as UiState.Playing
        api.progressIoAfterGuess = false; api.guessCode = 409   // server rejects the repeat
        val s = c.guess(after, "batman") as UiState.Finished
        assertTrue(s.notice.contains("+100"))                    // shown once, from server state
        assertEquals(2, api.guessCalls.size)
    }
    @Test fun refreshReturningNullKeepsOldClues() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progressNull = true
        val s = c.guess(cur, "x") as UiState.Playing
        assertEquals(1, s.progress.clues.size); assertTrue(s.notice.contains("Couldn't refresh"))
    }
}
