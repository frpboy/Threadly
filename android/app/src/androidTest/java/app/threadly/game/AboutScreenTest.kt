package app.threadly.game

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.Density
import app.threadly.game.ui.AboutScreen
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import app.threadly.game.data.*
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.BeforeClass
import org.junit.Assert.assertFalse
import java.net.Socket
import java.net.InetAddress
import java.net.InetSocketAddress
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** About-only UI: link handler is replaced, no browser/provider/backend is opened. */
class AboutScreenTest {
    companion object {
        @JvmStatic @BeforeClass fun verifyActualTargetUidAndBothNetworkFamilies() {
            val expected = InstrumentationRegistry.getArguments().getString("qaUid")?.toIntOrNull()
                ?: error("Missing mandatory fenced QA UID")
            assertEquals("Actual app process must use fenced UID", expected, android.os.Process.myUid())
            for (host in listOf("10.0.2.2", "1.1.1.1", "2606:4700:4700::1111")) {
                var connected = false
                try { Socket().use { it.connect(InetSocketAddress(InetAddress.getByName(host), 443), 1500); connected = true } }
                catch (_: java.io.IOException) { }
                assertFalse("App connection escaped egress fence: $host", connected)
            }
        }
    }
    @get:Rule val rule = createComposeRule()

    private fun shot(name: String) {
        rule.waitForIdle()
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        java.io.FileInputStream(pfd.fileDescriptor).use { it.readBytes() }
        pfd.close()
    }

    @Test fun sponsorNavigationAndLinksStayInsideTheTestHandler() {
        val opened = mutableListOf<String>()
        val visible = mutableStateOf(true)
        rule.setContent {
            CompositionLocalProvider(LocalUriHandler provides object : UriHandler {
                override fun openUri(uri: String) { opened += uri }
            }) {
                MaterialTheme(colorScheme = darkColorScheme()) {
                    if (visible.value) AboutScreen { visible.value = false }
                }
            }
        }
        shot("about-overview")
        rule.onNodeWithText("Sponsor").performScrollTo().performClick()
        rule.onNodeWithText("Support Threadly").assertIsDisplayed()
        shot("about-sponsor")
        rule.onNodeWithText("Buy Me a Coffee").performClick()
        rule.onNodeWithText("Patreon").performClick()
        rule.runOnIdle { assertEquals(listOf("https://buymeacoffee.com/frpboy", "https://www.patreon.com/c/FrpBoy"), opened) }
        rule.onNodeWithText("Back to About").performClick()
        rule.onNodeWithText("About Threadly").assertIsDisplayed()
        rule.onNodeWithText("Back to Threadly").performClick()
        rule.onNodeWithText("About Threadly").assertDoesNotExist()
    }

    @Test fun largeTextStillScrollsToVersionAndPackage() {
        rule.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, 1.6f)) {
                MaterialTheme(colorScheme = darkColorScheme()) { AboutScreen {} }
            }
        }
        rule.onNodeWithText("Version").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})").assertIsDisplayed()
        rule.onNodeWithText("Package name").performScrollTo().assertIsDisplayed()
        rule.onNodeWithText("com.frpboy.threadly.qa").assertIsDisplayed()
        shot("about-large-text")
        rule.onNodeWithText("Back to Threadly").performScrollTo().assertIsDisplayed()
    }

    @OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
    @Test fun returningFromAboutPreservesPendingGuess() {
        val api = object : GameApi {
            override suspend fun daily() = Daily("about-fixture", "Synthetic puzzle", 5)
            override suspend fun progress(puzzleId: String, guestId: String) = Progress(GameState.OPEN, 1, listOf("Synthetic clue"), emptyList(), 5, 0, "")
            override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome = error("About navigation must not submit a guess")
        }
        rule.setContent { GameScreen(GameViewModel(api, "about-fixture-guest")) }
        rule.waitUntilExactlyOneExists(hasTestTag("guess_input"), 5_000)
        rule.onNodeWithTag("guess_input").performTextInput("keep this input")
        rule.onNodeWithText("About Threadly").performClick()
        rule.onNodeWithText("Back to Threadly").performClick()
        rule.onNodeWithTag("guess_input").assertTextContains("keep this input")
    }

}
