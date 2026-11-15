package app.threadly.game.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** First-run content version. Bump when the steps change materially so returning testers see the new flow once. */
const val ONBOARDING_VERSION = 1

data class OnboardingStep(val title: String, val body: String)

val ONBOARDING_STEPS: List<OnboardingStep> = listOf(
    OnboardingStep(
        "Welcome to Threadly",
        "A clue puzzle. Every puzzle hides one connection, and your job is to find it.",
    ),
    OnboardingStep(
        "How to play",
        "Read the clue, then type what you think connects it. If your guess is wrong, the next clue is revealed.",
    ),
    OnboardingStep(
        "Score with fewer clues",
        "Solve using as few clues as you can. The fewer clues you need, the more points you earn.",
    ),
    OnboardingStep(
        "Your beta invitation",
        "This native beta needs a one-time invitation. It links this device only and expires when the test period ends.",
    ),
)

/**
 * Pure navigation state for the first-run flow. The UI renders [current]; persisting
 * completion is the caller's job (see OnboardingStore), so the flow itself stays testable.
 */
class OnboardingFlow(private val steps: List<OnboardingStep> = ONBOARDING_STEPS) {
    init { require(steps.isNotEmpty()) { "Onboarding needs at least one step" } }

    var index: Int by mutableStateOf(0)
        private set
    var done: Boolean by mutableStateOf(false)
        private set

    val current: OnboardingStep get() = steps[index]
    val isFirst: Boolean get() = index == 0
    val isLast: Boolean get() = index == steps.lastIndex
    val positionLabel: String get() = "${index + 1} of ${steps.size}"

    /** Advances one step, or finishes the flow from the last step. */
    fun next() { if (isLast) done = true else index += 1 }

    /** Moves back one step. No-op on the first step. */
    fun back() { if (!isFirst) index -= 1 }

    /** Finishes the flow immediately. */
    fun skip() { done = true }
}
