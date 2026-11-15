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
    var day: String? = "2026-11-14" // server puzzle day; null simulates a server that omits published_date
    val guessCalls = mutableListOf<String>()
    override suspend fun daily() = Daily("p1", "Puzzle", 5, day)
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

    private val recordedResults = mutableListOf<GameResult>()
    private var saveOk = true
    private val rc = GameController(api, "guest", recorder = { r -> if (saveOk) { recordedResults += r; true } else false })

    @Test fun finishedGuessRecordsExactlyOneResult() = runBlocking {
        val cur = rc.load() as UiState.Playing
        api.progress = solved(1, 100)
        rc.guess(cur, "batman") as UiState.Finished
        assertEquals(1, recordedResults.size)
        val res = recordedResults[0]
        assertEquals("p1", res.puzzleId)
        // midnight/wrong-clock: the recorded day is the server puzzle day; the device clock is never consulted
        assertEquals("2026-11-14", res.day)
        assertTrue(res.solved); assertEquals(1, res.cluesUsed); assertEquals(100, res.score)
    }
    @Test fun exhaustedGameRecordsFailure() = runBlocking {
        val cur = rc.load() as UiState.Playing
        api.progress = exhausted()
        rc.guess(cur, "nope") as UiState.Finished
        assertEquals(1, recordedResults.size)
        assertFalse(recordedResults[0].solved); assertEquals(5, recordedResults[0].cluesUsed)
    }
    @Test fun resumedFinishedGameRecordsOnceAndReloadDoesNotDuplicate() = runBlocking {
        api.progress = solved(2, 80)
        rc.load() as UiState.Finished
        rc.load() as UiState.Finished
        assertEquals(1, recordedResults.size)
        assertTrue(recordedResults[0].solved); assertEquals(2, recordedResults[0].cluesUsed)
    }
    @Test fun playingGameRecordsNothing() = runBlocking {
        rc.load() as UiState.Playing
        assertTrue(recordedResults.isEmpty())
    }
    @Test fun throwingRecorderNeverBreaksGameplay() = runBlocking {
        val bad = GameController(api, "guest", recorder = { throw RuntimeException("disk full") })
        val cur = bad.load() as UiState.Playing
        api.progress = solved(1, 100)
        val s = bad.guess(cur, "batman") as UiState.Finished
        assertTrue(s.notice.contains("+100"))
        assertFalse(s.statsSaved)
    }
    @Test fun failedSaveStaysPendingAndRetriesOnNextRender() = runBlocking {
        saveOk = false
        val cur = rc.load() as UiState.Playing
        api.progress = solved(1, 100)
        val failed = rc.guess(cur, "batman") as UiState.Finished
        assertFalse(failed.statsSaved); assertTrue(recordedResults.isEmpty())
        // no loop, no background retry: the next load retries once the store works
        saveOk = true
        val retried = rc.load() as UiState.Finished
        assertTrue(retried.statsSaved)
        assertEquals(1, recordedResults.size); assertEquals("2026-11-14", recordedResults[0].day)
    }
    @Test fun finishedWithoutStoreReportsSaved() = runBlocking {
        api.progress = solved(1, 100)
        val s = c.load() as UiState.Finished   // c has no recorder: nothing to save
        assertTrue(s.statsSaved)
    }

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
    @Test fun unknownServerDayIsNeverFabricatedPersistedOrShared() = runBlocking {
        api.day = null
        api.progress = solved(1, 100)
        val s = rc.load() as UiState.Finished
        assertNull(s.puzzleDay)
        assertTrue(s.statsSaved)              // nothing to save: undated results are not persisted
        assertTrue(recordedResults.isEmpty()) // no fabricated day reaches the store
        val card = ShareCard.build(
            GameResult(s.puzzleId, day = "", solved = true, cluesUsed = 1, score = 100),
            totalClues = 5,
            day = s.puzzleDay,
        )
        assertEquals("Threadly", card.lines()[0]) // no date invented for the share card
    }
    @Test fun failedSaveRetriesAtMostOncePerCall() = runBlocking {
        var attempts = 0
        val counting = GameController(api, "guest", recorder = { attempts++; false })
        api.progress = solved(1, 100)
        val s1 = counting.load() as UiState.Finished
        assertFalse(s1.statsSaved)
        assertEquals(1, attempts)  // one attempt per call, no recomposition loop
        counting.load()
        assertEquals(2, attempts)  // a later load retries exactly once more
    }
    @Test fun refreshReturningNullKeepsOldClues() = runBlocking {
        val cur = c.load() as UiState.Playing
        api.progressNull = true
        val s = c.guess(cur, "x") as UiState.Playing
        assertEquals(1, s.progress.clues.size); assertTrue(s.notice.contains("Couldn't refresh"))
    }
}
