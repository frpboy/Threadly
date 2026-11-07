package app.threadly.game

import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.unit.dp
import app.threadly.game.data.*
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import org.junit.Rule
import org.junit.Test
import java.io.IOException

/** Fake backend only: these tests never contact the Threadly server. */
private class ScriptedApi : GameApi {
    var progress = Progress(GameState.OPEN, 1, listOf("Wears a cape"), emptyList(), 5, 0, "")
    var guessCode = 200
    var failProgressAfterGuess = false
    private var guessed = false
    val guesses = mutableListOf<String>()
    override suspend fun daily() = Daily("p1", "Test puzzle", 5)
    override suspend fun progress(puzzleId: String, guestId: String): Progress? {
        if (failProgressAfterGuess && guessed) throw IOException("down"); return progress
    }
    override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome {
        guesses += text; guessed = true; return GuessOutcome(guessCode)
    }
}

@OptIn(androidx.compose.ui.test.ExperimentalTestApi::class)
class GameScreenTest {
    @get:Rule val rule = createComposeRule()

    private fun show(api: ScriptedApi) {
        rule.setContent { GameScreen(GameViewModel(api, "guest-0001")) }
        rule.waitUntil(5_000) { rule.onAllNodesWithText("Wears a cape", substring = true).fetchSemanticsNodes().isNotEmpty() ||
            rule.onAllNodesWithText("Retry").fetchSemanticsNodes().isNotEmpty() ||
            rule.onAllNodesWithText("Correct", substring = true).fetchSemanticsNodes().isNotEmpty() }
    }
    private fun type(text: String) {
        rule.onNodeWithTag("guess_input").performTextInput(text)
    }

    @Test fun resumesOpenGameFromServerProgress() {
        val api = ScriptedApi().apply {
            progress = Progress(GameState.OPEN, 3, listOf("a", "b", "c"), listOf("x", "y"), 5, 0, "")
        }
        rule.setContent { GameScreen(GameViewModel(api, "guest-0001")) }
        rule.waitUntilExactlyOneExists(hasText("3.  c"), 5_000)
        rule.onNodeWithText("Guesses: x, y").assertIsDisplayed()
    }

    @Test fun wrongGuessShowsNextServerClue() {
        val api = ScriptedApi(); show(api)
        api.progress = Progress(GameState.OPEN, 2, listOf("Wears a cape", "Lives in Gotham"), listOf("x"), 5, 0, "")
        type("x"); rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("2.  Lives in Gotham"), 5_000)
        rule.onNodeWithText("Not quite. Here is another clue.").assertIsDisplayed()
    }

    @Test fun scoredGuessFinishesAndHidesInput() {
        val api = ScriptedApi(); show(api)
        api.progress = Progress(GameState.SOLVED, 1, listOf("Wears a cape"), listOf("batman"), 5, 100, "Batman")
        type("batman"); rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("Correct! +100 points. Answer: Batman"), 5_000)
        rule.onNodeWithTag("guess_input").assertDoesNotExist()
    }

    @Test fun http409RecoversToServerState() {
        val api = ScriptedApi(); show(api)
        api.guessCode = 409
        api.progress = Progress(GameState.SOLVED, 3, listOf("a", "b", "c"), listOf("g"), 5, 60, "Batman")
        type("batman"); rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("Correct! +60 points. Answer: Batman"), 5_000)
    }

    @Test fun failedResyncKeepsOldClueAndTypedText() {
        val api = ScriptedApi(); show(api)
        api.failProgressAfterGuess = true
        type("batman"); rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("No connection. Try again."), 5_000)
        rule.onNodeWithText("Wears a cape", substring = true).assertIsDisplayed()
        rule.onNodeWithTag("guess_input").assertTextContains("batman")
    }

    @Test fun accessibilityGuessFieldAndButtonAreLabelledAndLargeEnough() {
        val api = ScriptedApi(); show(api)
        rule.onNodeWithContentDescription("Your guess").assertExists()
        type("x")
        rule.onNodeWithText("Guess").assertHasClickAction().assertHeightIsAtLeast(48.dp)
    }

    @Test fun noticeIsALiveRegionForTalkBack() {
        val api = ScriptedApi(); show(api)
        api.progress = Progress(GameState.OPEN, 2, listOf("a", "b"), listOf("x"), 5, 0, "")
        type("x"); rule.onNodeWithText("Guess").performClick()
        rule.waitUntilExactlyOneExists(hasText("Not quite. Here is another clue."), 5_000)
        rule.onNodeWithText("Not quite. Here is another clue.")
            .assert(SemanticsMatcher.keyIsDefined(SemanticsProperties.LiveRegion))
    }
}
