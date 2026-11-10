package app.threadly.game

import android.content.Context
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** Requires a separately reviewed owned loopback Next+PG fixture. Never a public backend. */
class BetaEnrollmentTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    private fun screenshot(name: String) {
        rule.waitForIdle()
        val automation=InstrumentationRegistry.getInstrumentation().uiAutomation
        automation.executeShellCommand("screencap -p /data/local/tmp/$name.png").use { pfd ->
            java.io.FileInputStream(pfd.fileDescriptor).use { it.readBytes() }
        }
    }
    @Test fun enrollsActualActivityPlaysAndResumesOnOwnedSyntheticServer() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        check(context.packageName.endsWith(".qa"))
        check(BuildConfig.API_BASE=="http://127.0.0.1:8765")
        val args=InstrumentationRegistry.getArguments()
        check(android.os.Process.myUid().toString()==args.getString("qaUid"))
        val invite=args.getString("beta_invitation") ?: error("Owned synthetic fixture invitation required")
        check(invite.matches(Regex("[A-Za-z0-9_-]{43}")))
        rule.onNodeWithText("Threadly native beta").assertIsDisplayed()
        // Capture BEFORE entering invitation; no credential/code screenshots.
        screenshot("beta-enrollment-empty")
        rule.onNodeWithText("Invitation").performTextInput(invite)
        rule.onNodeWithText("Start beta").performClick()
        rule.waitUntil(15000) { rule.onAllNodesWithText("1.  Synthetic native clue one").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("1.  Synthetic native clue one").assertIsDisplayed()
        screenshot("beta-open-first")
        rule.onNodeWithTag("guess_input").performTextInput("synthetic-wrong")
        rule.onNodeWithText("Guess",useUnmergedTree=true).performClick()
        rule.waitUntil(15000) { rule.onAllNodesWithText("2.  Synthetic native clue two").fetchSemanticsNodes().isNotEmpty() }
        screenshot("beta-wrong-second")
        rule.activityRule.scenario.recreate()
        rule.waitUntil(15000) { rule.onAllNodesWithText("2.  Synthetic native clue two").fetchSemanticsNodes().isNotEmpty() }
        rule.onNodeWithText("Guesses: synthetic-wrong").assertIsDisplayed()
        rule.onNodeWithTag("guess_input").performTextInput("synthetic connection")
        rule.onNodeWithText("Guess",useUnmergedTree=true).performClick()
        rule.waitUntil(15000) { rule.onAllNodesWithText("Correct!",substring=true).fetchSemanticsNodes().isNotEmpty() }
        screenshot("beta-solved")
        rule.activityRule.scenario.recreate()
        rule.waitUntil(15000) { rule.onAllNodesWithText("Correct!",substring=true).fetchSemanticsNodes().isNotEmpty() }
        assertTrue(app.threadly.game.data.DeviceCredentials(context).token()!=null)
        assertNull(app.threadly.game.data.DeviceCredentials(context).pending())
    }
}
