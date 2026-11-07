package app.threadly.game

import app.threadly.game.data.HttpGameApi
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class HttpGameApiTest {
    private fun server(vararg r: MockResponse): MockWebServer = MockWebServer().apply { r.forEach { enqueue(it) }; start() }
    private fun ok(body: String) = MockResponse().setResponseCode(200).setBody(body)

    @Test fun dailyRetriesOnceOn5xx() = runBlocking {
        val s = server(MockResponse().setResponseCode(500), ok("""{"puzzle_id":"p1","title":"T","total_clues":5}"""))
        val d = HttpGameApi(s.url("/").toString().trimEnd('/')).daily()
        assertEquals("p1", d?.puzzleId); assertEquals(2, s.requestCount); s.shutdown()
    }
    @Test fun guessBodyHasNoClueCountAndNoRetryOn409() = runBlocking {
        val s = server(MockResponse().setResponseCode(409).setBody("""{"already_solved":true}"""))
        val out = HttpGameApi(s.url("/").toString().trimEnd('/')).guess("p1", "g1", "batman")
        assertEquals(409, out.httpCode); assertEquals(1, s.requestCount)
        val body = JSONObject(s.takeRequest().body.readUtf8())
        assertEquals(setOf("puzzle_id", "guess", "guest_id"), body.keys().asSequence().toSet()); s.shutdown()
    }
    @Test fun progressParsesServerState() = runBlocking {
        val s = server(ok("""{"state":"open","clue_number":2,"clues":[{"order":1,"text":"a"},{"order":2,"text":"b"}],"guesses":["x"],"total_clues":5,"score_awarded":0}"""))
        val p = HttpGameApi(s.url("/").toString().trimEnd('/')).progress("p1", "g1")
        assertEquals(2, p?.clues?.size); assertEquals("/api/progress", s.takeRequest().path); s.shutdown()
    }
}
