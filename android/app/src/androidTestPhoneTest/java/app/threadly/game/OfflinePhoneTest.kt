package app.threadly.game
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Rule
import org.junit.Test
class OfflinePhoneTest {
    @get:Rule val rule = createAndroidComposeRule<OfflineTestActivity>()
    private fun shot(name: String) {
        rule.waitForIdle()
        val fd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        java.io.FileInputStream(fd.fileDescriptor).use { it.readBytes() }; fd.close()
    }
    private fun waitText(s: String) {
        println("OFFLINE_CHECKPOINT waiting: $s")
        try {
            rule.waitUntil(5000) { rule.onAllNodesWithText(s, substring=true).fetchSemanticsNodes().isNotEmpty() }
            println("OFFLINE_CHECKPOINT passed: $s")
        } catch (error: Throwable) {
            rule.onRoot(useUnmergedTree = true).printToLog("OFFLINE_FAILURE")
            runCatching { shot("phone-failure") }
            throw error
        }
    }
    @Test fun actualLauncherOfflineWrongRestoreSolveResetAndExhaust() {
        waitText("Wears a cape"); shot("phone-open")
        rule.onNodeWithTag("guess_input").performTextInput("wrong")
        rule.onNodeWithText("Guess").performClick(); waitText("A detective")
        rule.activityRule.scenario.recreate(); waitText("Guesses: wrong")
        rule.onNodeWithTag("guess_input").performTextInput("Batman")
        rule.onNodeWithText("Guess").performClick(); waitText("Correct! +80"); shot("phone-solved")
        rule.onNodeWithText("Reset sample").performClick(); waitText("Wears a cape")
        repeat(5) { i ->
            rule.onNodeWithTag("guess_input").performTextInput("wrong$i")
            rule.onNodeWithText("Guess").performClick()
            if (i < 4) waitText("Guesses: " + (0..i).joinToString(", ") { "wrong$it" })
        }
        waitText("Out of clues."); shot("phone-exhausted")
    }
}
