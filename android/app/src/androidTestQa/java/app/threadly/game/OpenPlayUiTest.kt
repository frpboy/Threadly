package app.threadly.game

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import app.threadly.game.data.BetaCredentials
import app.threadly.game.data.AccessDeniedException
import app.threadly.game.data.HttpGameApi
import app.threadly.game.data.PendingGuess
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import java.io.FileInputStream
import java.util.UUID
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/**
 * Open store-native play against the actual runner-local Next production bundle and
 * disposable PostgreSQL (THREADLY_NATIVE_OPEN=device-credentials). No fixture server.
 */
@OptIn(ExperimentalTestApi::class)
class OpenPlayUiTest {
    @get:Rule val rule = createComposeRule()

    /** In-memory BetaCredentials for tests; real keystore credentials are exercised by OpenPlayActivityTest. */
    private class FakeCreds(private val t: String, private val g: String) : BetaCredentials {
        private val ids = HashMap<String, String>()
        override fun token(): String = t
        override fun playerId(): String = g
        @Synchronized override fun requestId(puzzleId: String, guess: String): String =
            ids.getOrPut("$puzzleId|$guess") { UUID.randomUUID().toString() }
        override fun completeRequest() {}
        override fun pending(): PendingGuess? = null
    }

    private fun api(creds: BetaCredentials? = null) = HttpGameApi(BuildConfig.API_BASE, creds)
    private fun shot(name: String) {
        rule.waitForIdle()
        val pfd = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand("screencap -p /data/local/tmp/$name.png")
        FileInputStream(pfd.fileDescriptor).use { it.readBytes() }; pfd.close()
    }

    @Test fun openEnrollPlaysAndShowsPlayerIdAndDelete() {
        val (token, guest) = runBlocking {
            val r = api().enrollOpen()
            assertTrue("open enrollment must succeed against the open backend", r is HttpGameApi.OpenEnroll.Success)
            r as HttpGameApi.OpenEnroll.Success
            assertTrue(r.guestId.startsWith("dev-")); assertTrue(r.expiresAt > 0)
            r.token to r.guestId
        }
        val creds = FakeCreds(token, guest)
        rule.setContent { GameScreen(GameViewModel(api(creds), "server-owned-device", creds), onDeleted = {}) }
        rule.waitUntilExactlyOneExists(hasText("Player ID: $guest"), 20000)
        rule.onNodeWithText("Delete my data").assertIsDisplayed()
        rule.onNodeWithTag("guess_input").performTextInput("wrong")
        rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("Not quite. Here is another clue."), 20000)
        shot("open-play-game")
    }

    @Test fun openDeleteConfirmWipesServerIdentityAndCallsBack() {
        val creds = runBlocking {
            val r = api().enrollOpen() as HttpGameApi.OpenEnroll.Success
            FakeCreds(r.token, r.guestId).also {
                // one real scored guess + idempotency receipt to be deleted
                HttpGameApi(BuildConfig.API_BASE, it).guess(
                    "00000000-0000-4000-8000-000000000010", "server-owned-device", "wrong")
            }
        }
        var deleted = false
        rule.setContent { GameScreen(GameViewModel(api(creds), "server-owned-device", creds), onDeleted = { deleted = true }) }
        rule.waitUntilExactlyOneExists(hasText("Player ID:", substring = true), 20000)
        rule.onNodeWithText("Delete my data").performClick()
        rule.waitUntilExactlyOneExists(hasText("Delete your player data?"), 10000)
        shot("open-delete-confirm")
        rule.onNodeWithText("Delete permanently").performClick()
        rule.waitUntil(20000) { deleted }
        assertTrue(deleted)
        // The deleted credential is dead for gameplay AND for a second deletion.
        runBlocking {
            var denied = false
            try { api(creds).daily() } catch (e: AccessDeniedException) { denied = true }
            assertTrue("deleted credential must be dead for gameplay", denied)
            assertFalse(HttpGameApi(BuildConfig.API_BASE, creds).deletePlayerData())
        }
    }

    @Test fun expiredProfileShowsLifecycleScreenAndCanStillDelete() {
        val creds = FakeCreds("E".repeat(43), "dev-" + "e".repeat(48))
        var deleted = false
        rule.setContent { GameScreen(GameViewModel(api(creds), "server-owned-device", creds), onReenroll = {}, onDeleted = { deleted = true }) }
        rule.waitUntilExactlyOneExists(hasText("This device profile expired or was revoked."), 20000)
        rule.onNodeWithText("Delete my old data and start fresh").assertIsDisplayed()
        rule.onNodeWithText("Start a new profile").assertIsDisplayed()
        shot("open-profile-expired")
        rule.onNodeWithText("Delete my old data and start fresh").performClick()
        rule.waitUntilExactlyOneExists(hasText("Delete your player data?"), 10000)
        rule.onNodeWithText("Delete permanently").performClick()
        rule.waitUntil(20000) { deleted }
        assertTrue(deleted)
    }

    @Test fun cappedProfileShowsLifecycleScreenAndCanStillDelete() {
        val creds = FakeCreds("C".repeat(43), "dev-" + "c".repeat(48))
        var deleted = false
        rule.setContent { GameScreen(GameViewModel(api(creds), "server-owned-device", creds), onReenroll = {}, onDeleted = { deleted = true }) }
        rule.waitUntilExactlyOneExists(hasText("This device profile expired or was revoked."), 20000)
        rule.onNodeWithText("Delete my old data and start fresh").performClick()
        rule.waitUntilExactlyOneExists(hasText("Delete your player data?"), 10000)
        rule.onNodeWithText("Delete permanently").performClick()
        rule.waitUntil(20000) { deleted }
        assertTrue(deleted)
    }

    @Test fun unreachableServerClassifiesTransientNeverInvitation() {
        runBlocking {
            val r = HttpGameApi("http://127.0.0.1:9").enrollOpen()
            assertTrue("closed port must classify Transient, was $r", r is HttpGameApi.OpenEnroll.Transient)
        }
    }
}
