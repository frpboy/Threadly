package app.threadly.game

import app.threadly.game.data.GameState
import app.threadly.game.data.Progress
import org.json.JSONException
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class ProgressTest {
    private fun p(json: String) = Progress.parse(JSONObject(json))

    @Test fun openResumesAtServerClueAndNeverKeepsAnAnswer() {
        val x = p("""{"state":"open","clue_number":3,"clues":[{"order":1,"text":"a"},{"order":2,"text":"b"},{"order":3,"text":"c"}],"guesses":["x","y"],"total_clues":5,"score_awarded":0,"answer":"leak"}""")
        assertFalse(x.finished); assertEquals(3, x.clues.size); assertEquals(3, x.clueNumber); assertEquals("", x.answer)
        assertEquals(listOf("x", "y"), x.guesses)
    }
    @Test fun solvedIsFinishedWithScoreAndAnswer() {
        val x = p("""{"state":"solved","clue_number":2,"clues":[{"order":1,"text":"a"},{"order":2,"text":"b"}],"guesses":["x","r"],"total_clues":5,"score_awarded":80,"answer":"r"}""")
        assertTrue(x.finished); assertEquals(GameState.SOLVED, x.state); assertEquals(80, x.score); assertEquals("r", x.answer)
    }
    @Test fun exhaustedIsFinishedWithAnswer() {
        val x = p("""{"state":"exhausted","clue_number":5,"clues":[{"order":1,"text":"a"}],"guesses":[],"total_clues":5,"score_awarded":0,"answer":"z"}""")
        assertTrue(x.finished); assertEquals("z", x.answer)
    }
    @Test(expected = JSONException::class) fun unknownStateRejected() { p("""{"state":"weird","clue_number":1,"clues":[]}""") }
}
