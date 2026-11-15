package app.threadly.game

import app.threadly.game.ui.ONBOARDING_STEPS
import app.threadly.game.ui.ONBOARDING_VERSION
import app.threadly.game.ui.OnboardingFlow
import app.threadly.game.ui.OnboardingStep
import org.junit.Assert.*
import org.junit.Test

class OnboardingFlowTest {
    @Test fun startsOnFirstStepNotDone() {
        val flow = OnboardingFlow()
        assertEquals(0, flow.index)
        assertTrue(flow.isFirst)
        assertFalse(flow.isLast)
        assertFalse(flow.done)
        assertEquals("1 of ${ONBOARDING_STEPS.size}", flow.positionLabel)
        assertEquals(ONBOARDING_STEPS.first(), flow.current)
    }

    @Test fun nextAdvancesAndFinishesFromLastStep() {
        val flow = OnboardingFlow()
        repeat(ONBOARDING_STEPS.size - 1) { flow.next() }
        assertTrue(flow.isLast)
        assertFalse(flow.done)
        assertEquals(ONBOARDING_STEPS.last(), flow.current)
        flow.next()
        assertTrue(flow.done)
    }

    @Test fun backStopsAtFirstStep() {
        val flow = OnboardingFlow()
        flow.back()
        assertEquals(0, flow.index)
        flow.next()
        flow.next()
        flow.back()
        assertEquals(1, flow.index)
        assertFalse(flow.done)
    }

    @Test fun skipFinishesImmediately() {
        val flow = OnboardingFlow()
        flow.skip()
        assertTrue(flow.done)
        assertEquals(0, flow.index)
    }

    @Test fun acceptsCustomSteps() {
        val flow = OnboardingFlow(listOf(OnboardingStep("Only", "One step.")))
        assertTrue(flow.isFirst)
        assertTrue(flow.isLast)
        assertEquals("1 of 1", flow.positionLabel)
        flow.next()
        assertTrue(flow.done)
    }

    @Test fun rejectsEmptySteps() {
        assertThrows(IllegalArgumentException::class.java) { OnboardingFlow(emptyList()) }
    }

    @Test fun shippedContentCoversRulesScoringAndInvitation() {
        assertTrue(ONBOARDING_VERSION >= 1)
        val text = ONBOARDING_STEPS.joinToString(" ") { it.title + " " + it.body }
        assertTrue(text.contains("connection"))
        assertTrue(text.contains("wrong"))
        assertTrue(text.contains("fewer clues"))
        assertTrue(text.contains("invitation"))
    }
}
