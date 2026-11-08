package app.threadly.game

import app.threadly.game.data.HttpGameApi
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.mockwebserver.SocketPolicy

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

    @Test fun guessIsNotRetriedOnServerErrorBecauseItMayHaveCommitted() = runBlocking {
        val s = server(MockResponse().setResponseCode(500), MockResponse().setResponseCode(200))
        try {
            assertEquals(500, HttpGameApi(s.url("/").toString().trimEnd('/')).guess("p1", "guest123", "wrong").httpCode)
            assertEquals(1, s.requestCount)
        } finally { s.shutdown() }
    }
    @Test fun guessIsNotRetriedOnLostResponseBecauseItMayHaveCommitted() = runBlocking {
        val s = server(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST), MockResponse().setResponseCode(200))
        try {
            try { HttpGameApi(s.url("/").toString().trimEnd('/')).guess("p1", "guest123", "wrong"); fail("expected IOException") }
            catch (_: IOException) {}
            assertNotNull(s.takeRequest(2, TimeUnit.SECONDS))
            assertNull(s.takeRequest(300, TimeUnit.MILLISECONDS))
            assertEquals(1, s.requestCount)
        } finally { s.shutdown() }
    }
    @Test fun malformedSuccessfulPuzzleAndProgressBecomeRecoverableIoErrors() = runBlocking {
        for (progress in listOf(false, true)) {
            val s = server(ok(if (progress) """{"state":"unknown"}""" else """{"title":"missing id"}"""))
            try {
                val api = HttpGameApi(s.url("/").toString().trimEnd('/'))
                try { if (progress) api.progress("p1", "guest123") else api.daily(); fail("expected IOException") }
                catch (_: IOException) {}
                assertEquals(1, s.requestCount)
            } finally { s.shutdown() }
        }
    }
}
