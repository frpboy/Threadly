package app.threadly.game.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val OnboardingBg = Color(0xFF12141C)
private val OnboardingCard = Color(0xFF1E2230)
private val OnboardingMuted = Color(0xFFAAB0C0)

/**
 * First-run how-to-play flow, shown once before enrollment. Finishing or skipping calls
 * [onFinish] exactly once per tap; the caller persists completion so this is never forced again.
 */
@Composable
fun OnboardingScreen(onFinish: () -> Unit, flow: OnboardingFlow = remember { OnboardingFlow() }, saveFailed: Boolean = false) {
    MaterialTheme(colorScheme = darkColorScheme()) {
        Column(
            Modifier.fillMaxSize().background(OnboardingBg).safeDrawingPadding().padding(24.dp),
        ) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(flow.positionLabel, color = OnboardingMuted, fontSize = 14.sp)
                Spacer(Modifier.weight(1f))
                if (!flow.isLast) {
                    TextButton(
                        onClick = { flow.skip(); onFinish() },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("onboarding_skip"),
                    ) { Text("Skip") }
                }
            }
            Spacer(Modifier.weight(1f))
            Column(
                Modifier.fillMaxWidth()
                    .background(OnboardingCard, RoundedCornerShape(12.dp))
                    .padding(20.dp),
            ) {
                Text(flow.current.title, color = Color.White, fontSize = 24.sp)
                Spacer(Modifier.height(12.dp))
                Text(flow.current.body, color = OnboardingMuted, fontSize = 18.sp)
            }
            Spacer(Modifier.weight(1f))
            if (saveFailed) {
                Text(
                    "Could not save. Check your device storage and try again.",
                    color = Color(0xFFFFD479), fontSize = 16.sp,
                    modifier = Modifier.padding(bottom = 12.dp).semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                if (!flow.isFirst) {
                    OutlinedButton(
                        onClick = { flow.back() },
                        modifier = Modifier.heightIn(min = 48.dp).testTag("onboarding_back"),
                    ) { Text("Back") }
                    Spacer(Modifier.width(12.dp))
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = { flow.next(); if (flow.done) onFinish() },
                    modifier = Modifier.heightIn(min = 48.dp)
                        .semantics { contentDescription = if (flow.isLast) "Start Threadly" else "Next onboarding step" }
                        .testTag("onboarding_next"),
                ) { Text(if (flow.isLast) "Start" else "Next") }
            }
        }
    }
}
