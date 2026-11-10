package app.threadly.game

import app.threadly.game.data.*
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.util.UUID

class BetaHttpTest {
    private class MemoryDevice : BetaCredentials {
        var saved: PendingGuess? = null
        override fun token() = "T".repeat(43)
        override fun pending() = saved
        override fun requestId(puzzleId: String, guess: String): String {
            saved?.let { if (it.puzzleId != puzzleId || it.text != guess) throw PendingGuessException(it.text); return it.requestId }
            return UUID.randomUUID().toString().also { saved = PendingGuess(puzzleId, guess, it) }
        }
        override fun completeRequest() { saved = null }
    }
    @Test fun serverFailureKeepsSameRequestForExplicitRetry() = runBlocking {
        val server = MockWebServer(); server.enqueue(MockResponse().setResponseCode(500)); server.enqueue(MockResponse().setBody("{\"correct\":false,\"clues_used\":1,\"score_awarded\":0}")); server.start()
        try {
            val device = MemoryDevice(); val api = HttpGameApi(server.url("/").toString().trimEnd('/'), device)
            assertEquals(500, api.guess("p", "forged", "wrong").httpCode); val original = device.saved!!.requestId
            assertEquals(200, api.guess("p", "forged", "wrong").httpCode); assertNull(device.saved)
            val first = server.takeRequest(); val second = server.takeRequest()
            assertEquals("Bearer " + "T".repeat(43), first.getHeader("Authorization"))
            assertEquals(original, JSONObject(first.body.readUtf8()).getString("request_id")); assertEquals(original, JSONObject(second.body.readUtf8()).getString("request_id"))
        } finally { server.shutdown() }
    }
    @Test fun lostResponseKeepsPendingUuidAndDifferentPayloadDoesNotSend() = runBlocking {
        val server = MockWebServer(); server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AFTER_REQUEST)); server.start()
        try {
            val device = MemoryDevice(); val api = HttpGameApi(server.url("/").toString().trimEnd('/'), device)
            try { api.guess("p", "ignored", "wrong"); fail("expected lost response") } catch (_: IOException) {}
            val saved = device.saved!!; assertEquals(1, server.requestCount)
            try { api.guess("p", "ignored", "changed"); fail("expected pending guard") } catch (_: PendingGuessException) {}
            assertEquals(saved, device.saved); assertEquals(1, server.requestCount)
            server.enqueue(MockResponse().setBody("{\"correct\":false,\"clues_used\":1,\"score_awarded\":0}")); api.guess("p", "ignored", "wrong"); assertNull(device.saved)
            assertEquals(JSONObject(server.takeRequest().body.readUtf8()).getString("request_id"), JSONObject(server.takeRequest().body.readUtf8()).getString("request_id"))
        } finally { server.shutdown() }
    }
    @Test fun unauthorizedIsNotRetriedAndDoesNotDropUncertainIntent() = runBlocking {
        val server = MockWebServer(); server.enqueue(MockResponse().setResponseCode(401)); server.start()
        try {
            val device = MemoryDevice(); val api = HttpGameApi(server.url("/").toString().trimEnd('/'), device)
            try { api.guess("p", "ignored", "wrong"); fail("expected access failure") } catch (_: AccessDeniedException) {}
            assertNotNull(device.pending()); assertEquals(1, server.requestCount)
        } finally { server.shutdown() }
    }
    @Test fun malformed200KeepsPendingAndRedirectDoesNotForwardCredential() = runBlocking {
        val destination = MockWebServer(); destination.start()
        val server = MockWebServer(); server.enqueue(MockResponse().setBody("{}")); server.enqueue(MockResponse().setResponseCode(302).addHeader("Location", destination.url("/"))); server.start()
        try {
            val device = MemoryDevice(); val api = HttpGameApi(server.url("/").toString().trimEnd('/'), device)
            try { api.guess("p", "ignored", "wrong"); fail("expected malformed response") } catch (_: IOException) {}
            assertNotNull(device.pending()); assertEquals(302, api.guess("p", "ignored", "wrong").httpCode)
            assertNotNull(device.pending()); assertEquals(0, destination.requestCount)
        } finally { server.shutdown(); destination.shutdown() }
    }
    @Test fun onlyRecognizedTerminalConflictClearsPending() = runBlocking {
        val server = MockWebServer(); server.enqueue(MockResponse().setResponseCode(409).setBody("{\"error\":\"Request ID conflict\"}")); server.enqueue(MockResponse().setResponseCode(409).setBody("{\"exhausted\":true}")); server.start()
        try {
            val device = MemoryDevice(); val api = HttpGameApi(server.url("/").toString().trimEnd('/'), device)
            api.guess("p", "ignored", "wrong"); assertNotNull(device.pending())
            api.guess("p", "ignored", "wrong"); assertNull(device.pending())
        } finally { server.shutdown() }
    }
}
