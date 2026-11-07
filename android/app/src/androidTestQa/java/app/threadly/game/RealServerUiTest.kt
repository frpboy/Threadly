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
import java.net.Socket
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Actual runner-local Next production bundle and disposable PostgreSQL, no fixture server. */
@OptIn(ExperimentalTestApi::class)
class RealServerUiTest {
    @get:Rule val rule = createComposeRule()
    private val puzzle = "00000000-0000-4000-8000-000000000010"
    private fun api(): HttpGameApi {
        check(BuildConfig.API_BASE == "http://127.0.0.1:8765")
        return HttpGameApi(BuildConfig.API_BASE)
    }
    private fun vm(guest: String) = GameViewModel(api(), guest)
    private fun waitFor(text: String) { rule.waitUntilExactlyOneExists(hasText(text), 10000) }
    private fun shot(name: String) {
        rule.waitForIdle()
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        FileInputStream(pfd.fileDescriptor).use { it.readBytes() }; pfd.close()
    }
    @Test fun actualServerResumeHidesAnswer() {
        rule.setContent { GameScreen(vmForResume) }
        waitFor("2.  Second clue")
        rule.onNodeWithText("Guesses: wrong").assertIsDisplayed()
        rule.onAllNodesWithText("sentinel-answer", substring = true).assertCountEquals(0)
        rule.onNodeWithTag("guess_input").assertIsDisplayed()
        shot("loopback-resume")
    }
    private val vmForResume by lazy { vm("real-gate-resume") }
    @Test fun actualServerSolveAndRestoreOnlyOneAward() {
        val current = mutableStateOf(vm("real-gate-solve"))
        rule.setContent { GameScreen(current.value) }
        waitFor("2.  Second clue")
        rule.onNodeWithTag("guess_input").performTextInput("sentinel-answer")
        rule.onNodeWithText("Guess").performClick()
        waitFor("Correct! +80 points. Answer: sentinel-answer")
        rule.onNodeWithTag("guess_input").assertDoesNotExist()
        rule.runOnIdle { current.value = vm("real-gate-solve") }
        waitFor("Correct! +80 points. Answer: sentinel-answer")
        rule.onNodeWithTag("guess_input").assertDoesNotExist()
        shot("loopback-solved")
    }
    @Test fun actualServerExhaustedRejectsFurtherGuess() {
        runBlocking {
            assertEquals(puzzle, api().daily()?.puzzleId)
            assertEquals(409, api().guess(puzzle, "real-gate-exhausted", "sentinel-answer").httpCode)
        }
        rule.setContent { GameScreen(vmForExhausted) }
        waitFor("Out of clues. The answer was: sentinel-answer")
        rule.onNodeWithTag("guess_input").assertDoesNotExist()
        shot("loopback-exhausted")
    }
    private val vmForExhausted by lazy { vm("real-gate-exhausted") }
    @Test fun actualServerTransportStillUsesFencedProcessUid() {
        val expected = InstrumentationRegistry.getArguments().getString("qaUid")?.toIntOrNull()
            ?: error("missing mandatory QA UID")
        assertEquals(expected, android.os.Process.myUid())
        // Positive control proves the one adb-reversed loopback API is reachable.
        runBlocking { assertEquals(puzzle, api().daily()?.puzzleId) }
        for (host in listOf("10.0.2.2", "1.1.1.1", "2606:4700:4700::1111")) {
            var connected = false
            try { Socket().use { it.connect(InetSocketAddress(InetAddress.getByName(host),443),1500); connected=true } }
            catch (_: java.io.IOException) { }
            assertFalse("app egress escaped containment: $host", connected)
        }
    }
}
