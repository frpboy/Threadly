package app.threadly.game

import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import app.threadly.game.data.HttpGameApi
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import java.io.FileInputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Real native HTTP client, real VM and UI, synthetic device-loopback server only. */
@OptIn(ExperimentalTestApi::class)
class LoopbackHttpUiTest {
    @get:Rule val rule = createComposeRule()
    private val puzzle = "00000000-0000-4000-8000-000000000001"
    private val guest = "00000000-0000-4000-8000-000000000002"
    private var server: Fixture? = null
    private data class Reply(val method: String, val path: String, val status: Int, val body: String, val guess: String? = null)
    private inner class Fixture(replies: List<Reply>) : AutoCloseable {
        val queue = LinkedBlockingQueue(replies)
        val failure = AtomicReference<Throwable?>(null)
        val requests = LinkedBlockingQueue<String>()
        @Volatile var stopped = false
        private val listener = ServerSocket().apply {
            reuseAddress = true; bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), 8765)); soTimeout = 500
        }
        private val worker = thread(name = "threadly-loopback-fixture", isDaemon = true) {
            try {
                while (!stopped) {
                    val socket = try { listener.accept() } catch (e: java.net.SocketTimeoutException) { continue }
                    socket.use { s ->
                        s.soTimeout = 3000
                        val input = s.getInputStream().bufferedReader(Charsets.UTF_8)
                        val line = input.readLine() ?: error("missing request")
                        val parts = line.split(" "); val expected = queue.poll() ?: error("unexpected extra request: $line")
                        check(parts[0] == expected.method && parts[1] == expected.path) { "unexpected route: $line" }
                        var size = 0
                        while (true) {
                            val h = input.readLine() ?: error("incomplete headers")
                            if (h.isEmpty()) break
                            if (h.startsWith("Content-Length:", true)) size = h.substringAfter(':').trim().toInt()
                        }
                        check(size in 0..2048)
                        val chars = CharArray(size); var n = 0
                        while (n < size) { val count = input.read(chars, n, size - n); check(count > 0); n += count }
                        if (expected.method == "POST") {
                            val body = JSONObject(String(chars))
                            val keys = body.keys().asSequence().toSet()
                            check(keys == if (expected.guess == null) setOf("puzzle_id", "guest_id") else setOf("puzzle_id", "guest_id", "guess"))
                            check(body.getString("puzzle_id") == puzzle && body.getString("guest_id") == guest)
                            if (expected.guess != null) check(body.getString("guess") == expected.guess)
                        }
                        requests.add(parts[1])
                        val bytes = expected.body.toByteArray(Charsets.UTF_8)
                        s.getOutputStream().apply {
                            write("HTTP/1.1 ${expected.status} Fixture\r\nContent-Type: application/json\r\nCache-Control: private, no-store\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray()); write(bytes); flush()
                        }
                    }
                }
            } catch (t: Throwable) { if (!stopped) failure.set(t) }
        }
        fun verify() { assertNull("fixture failure: ${failure.get()}", failure.get()); assertTrue("unconsumed replies: ${queue.size}", queue.isEmpty()) }
        override fun close() { stopped = true; listener.close(); worker.join(4000); assertFalse("fixture thread still alive", worker.isAlive) }
    }
    @After fun cleanup() { server?.close(); server = null }
    private fun snapshot(state: String, answer: String = "sentinel-answer") = """{"state":"$state","clue_number":2,"clues":[{"order":1,"text":"First clue"},{"order":2,"text":"Second clue"}],"guesses":["wrong"],"total_clues":2,"score_awarded":${if(state == "solved") 80 else 0},"answer":"$answer"}"""
    private fun daily() = Reply("GET", "/api/daily", 200, """{"puzzle_id":"$puzzle","title":"Synthetic only","total_clues":2}""")
    private fun progress(state: String) = Reply("POST", "/api/progress", 200, snapshot(state))
    private fun start(vararg replies: Reply): GameViewModel {
        check(BuildConfig.API_BASE == "http://127.0.0.1:8765") { "QA origin must be exact device loopback" }
        server = Fixture(replies.toList()); return vm()
    }
    private fun vm() = GameViewModel(HttpGameApi(BuildConfig.API_BASE), guest)
    private fun waitFor(text: String) { rule.waitUntilExactlyOneExists(hasText(text), 8000) }
    private fun submit() { rule.onNodeWithTag("guess_input").performTextInput("answer"); rule.onNodeWithText("Guess").performClick() }
    private fun shot(name: String) {
        rule.waitForIdle()
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        FileInputStream(pfd.fileDescriptor).use { it.readBytes() }; pfd.close()
    }
    @Test fun actualHttpResumeHidesOpenAnswer() {
        val vm = start(daily(), progress("open")); rule.setContent { GameScreen(vm) }
        waitFor("2.  Second clue"); rule.onNodeWithText("Guesses: wrong").assertIsDisplayed()
        rule.onAllNodesWithText("sentinel-answer", substring = true).assertCountEquals(0)
        server!!.verify(); shot("loopback-resume")
    }
    @Test fun actualHttpSolveAndNewVmRestore() {
        val initial = start(daily(), progress("open"), Reply("POST", "/api/guess", 200, "{}", "answer"), progress("solved"), daily(), progress("solved"))
        val current = mutableStateOf(initial); rule.setContent { GameScreen(current.value) }
        waitFor("2.  Second clue"); submit(); waitFor("Correct! +80 points. Answer: sentinel-answer")
        rule.onNodeWithTag("guess_input").assertDoesNotExist()
        rule.runOnIdle { current.value = vm() }
        waitFor("Correct! +80 points. Answer: sentinel-answer")
        rule.waitUntil(8000) { server!!.requests.size == 6 }
        server!!.verify(); assertEquals(1, server!!.requests.count { it == "/api/guess" }); shot("loopback-solved")
    }
    @Test fun actualHttp409ResyncsExhausted() {
        val vm = start(daily(), progress("open"), Reply("POST", "/api/guess", 409, "{}", "answer"), progress("exhausted"))
        rule.setContent { GameScreen(vm) }; waitFor("2.  Second clue"); submit()
        waitFor("Out of clues. The answer was: sentinel-answer"); rule.onNodeWithTag("guess_input").assertDoesNotExist()
        server!!.verify(); assertEquals(1, server!!.requests.count { it == "/api/guess" }); shot("loopback-exhausted")
    }
    @Test fun actualHttpFailedRefreshKeepsTypedTextAndClue() {
        val vm = start(daily(), progress("open"), Reply("POST", "/api/guess", 200, "{}", "answer"), Reply("POST", "/api/progress", 400, "{}"))
        rule.setContent { GameScreen(vm) }; waitFor("2.  Second clue"); submit(); waitFor("Couldn't refresh. Try again.")
        rule.onNodeWithTag("guess_input").assertTextContains("answer"); rule.onNodeWithText("2.  Second clue").assertIsDisplayed(); server!!.verify()
    }
    @Test fun mandatoryExternalIpv4AndIpv6ConnectionsFail() {
        // The firewall is scoped to this exact installed target UID, not adbd/root.
        val expectedUid = InstrumentationRegistry.getArguments().getString("qaUid")?.toIntOrNull()
            ?: error("missing mandatory QA UID argument")
        assertEquals("instrumentation must execute under fenced target UID", expectedUid, android.os.Process.myUid())
        for (host in listOf("10.0.2.2", "1.1.1.1", "2606:4700:4700::1111")) {
            var connected = false
            try { Socket().use { it.connect(InetSocketAddress(InetAddress.getByName(host), 443), 1500); connected = true } }
            catch (_: java.io.IOException) { }
            assertFalse("guest egress escaped containment: $host", connected)
        }
    }
}
