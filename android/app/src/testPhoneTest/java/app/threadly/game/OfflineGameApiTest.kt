package app.threadly.game
import app.threadly.game.data.GameState
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
class OfflineGameApiTest {
    @Test fun wrongRestoreSolveAndReplay() = runBlocking {
        var saved = emptyList<String>()
        val api = OfflineGameApi { saved = it }
        assertEquals("", api.progress("p", "g").answer)
        assertEquals(200, api.guess("p", "g", "wrong").httpCode)
        val restored = OfflineGameApi(saved)
        assertEquals(2, restored.progress("p", "g").clueNumber)
        restored.guess("p", "g", "batman")
        assertEquals(80, restored.progress("p", "g").score)
        assertEquals(GameState.SOLVED, restored.progress("p", "g").state)
        assertEquals(409, restored.guess("p", "g", "Batman").httpCode)
    }
    @Test fun fiveWrongExhaustAndNeverAward() = runBlocking {
        val api = OfflineGameApi()
        repeat(5) { assertEquals(200, api.guess("p", "g", "wrong").httpCode) }
        assertEquals(GameState.EXHAUSTED, api.progress("p", "g").state)
        assertEquals(0, api.progress("p", "g").score)
        assertEquals(409, api.guess("p", "g", "Batman").httpCode)
    }
}
