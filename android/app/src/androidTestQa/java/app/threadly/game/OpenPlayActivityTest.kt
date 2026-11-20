package app.threadly.game

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import java.io.FileInputStream
import org.junit.Rule
import org.junit.Test

/**
 * Full MainActivity path: fresh install -> onboarding -> SILENT open self-enrollment
 * (no invitation UI) -> game screen with the real keystore-backed credential.
 */
@OptIn(ExperimentalTestApi::class)
class OpenPlayActivityTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()
    private fun shot(name: String) {
        rule.waitForIdle()
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        FileInputStream(pfd.fileDescriptor).use { it.readBytes() }; pfd.close()
    }

    @Test fun freshInstallSilentlySelfEnrollsIntoGame() {
        // Onboarding shows on first launch only; Skip when present.
        val skipped = rule.onAllNodesWithText("Skip").fetchSemanticsNodes().isNotEmpty()
        if (skipped) rule.onNodeWithText("Skip").performClick()
        // The invitation gate must NEVER appear on an open backend: no manual code entry.
        rule.waitUntilExactlyOneExists(hasText("Player ID:", substring = true), 30000)
        rule.onAllNodesWithText("Invitation", substring = true).assertCountEquals(0)
        rule.onNodeWithText("Delete my data").assertIsDisplayed()
        shot("open-full-activity")
    }
}
