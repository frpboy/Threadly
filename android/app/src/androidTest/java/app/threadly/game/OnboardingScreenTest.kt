package app.threadly.game

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import app.threadly.game.ui.ONBOARDING_STEPS
import app.threadly.game.ui.OnboardingFlow
import app.threadly.game.ui.OnboardingScreen
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test

/** UI-only flow test: no server, no credential storage involved. */
class OnboardingScreenTest {
    @get:Rule val rule = createComposeRule()

    private fun show(flow: OnboardingFlow = OnboardingFlow(), onFinish: () -> Unit = {}) {
        rule.setContent { OnboardingScreen(onFinish = onFinish, flow = flow) }
        rule.waitForIdle()
    }

    @Test fun walksEveryStepThenFinishes() {
        var finished = 0
        val flow = OnboardingFlow()
        show(flow) { finished += 1 }
        rule.onNodeWithText(ONBOARDING_STEPS[0].title).assertIsDisplayed()
        rule.onNodeWithText("1 of ${ONBOARDING_STEPS.size}").assertIsDisplayed()
        rule.onNodeWithTag("onboarding_back").assertDoesNotExist()
        ONBOARDING_STEPS.drop(1).forEach { step ->
            rule.onNodeWithTag("onboarding_next").performClick()
            rule.onNodeWithText(step.title).assertIsDisplayed()
        }
        assertEquals(0, finished)
        rule.onNodeWithTag("onboarding_skip").assertDoesNotExist()
        rule.onNodeWithTag("onboarding_next").performClick()
        assertEquals(1, finished)
    }

    @Test fun backReturnsToPreviousStep() {
        val flow = OnboardingFlow()
        show(flow)
        rule.onNodeWithTag("onboarding_next").performClick()
        rule.onNodeWithTag("onboarding_back").performClick()
        rule.onNodeWithText(ONBOARDING_STEPS[0].title).assertIsDisplayed()
    }

    @Test fun skipFinishesFromFirstStep() {
        var finished = 0
        show { finished += 1 }
        rule.onNodeWithTag("onboarding_skip").performClick()
        assertEquals(1, finished)
    }

    @Test fun buttonsMeetMinimumTouchSize() {
        show()
        rule.onNodeWithTag("onboarding_next").assertHasClickAction().assertHeightIsAtLeast(48.dp)
        rule.onNodeWithTag("onboarding_skip").assertHasClickAction().assertHeightIsAtLeast(48.dp)
    }
}
