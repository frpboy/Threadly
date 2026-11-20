package app.threadly.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import app.threadly.game.data.DeviceCredentials
import app.threadly.game.data.HttpGameApi
import app.threadly.game.data.OnboardingStore
import app.threadly.game.data.StatsStore
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import app.threadly.game.ui.ONBOARDING_VERSION
import app.threadly.game.ui.OnboardingScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.SENTRY_SELFTEST && !intent.getBooleanExtra("skip_selftest_crash", false)) {
            // Labeled synthetic crash for Sentry release-path qualification. False in
            // every shipped variant; true only in the debug-signed selftest build.
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                throw RuntimeException("Threadly Sentry self-test: synthetic labeled crash for release-path qualification; not an app defect")
            }, 3000)
        }
        val device = DeviceCredentials(this)
        val onboarding = OnboardingStore(this)
        setContent {
            // First-install flow only: an existing device credential means an upgrading
            // already-enrolled install, which keeps its current path with no replay.
            var showOnboarding by remember { mutableStateOf(device.token() == null && !onboarding.isComplete(ONBOARDING_VERSION)) }
            var onboardingSaveFailed by remember { mutableStateOf(false) }
            var enrolled by remember { mutableStateOf(device.token() != null) }
            if (showOnboarding) {
                OnboardingScreen(saveFailed = onboardingSaveFailed, onFinish = {
                    if (onboarding.tryMarkComplete(ONBOARDING_VERSION)) {
                        onboardingSaveFailed = false
                        showOnboarding = false
                    } else {
                        onboardingSaveFailed = true
                    }
                })
            } else if (enrolled) {
                val vm: GameViewModel = viewModel(key = "beta-" + device.sessionKey(), factory = object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T =
                        GameViewModel(HttpGameApi(BuildConfig.API_BASE, device), "server-owned-device", device, StatsStore(this@MainActivity)) as T
                })
                GameScreen(vm, onReenroll = { enrolled = false }, onDeleted = { enrolled = false })
            } else {
                var code by remember { mutableStateOf("") }
                var busy by remember { mutableStateOf(false) }
                var gate by remember { mutableStateOf("trying") } // trying | retry | invitation
                var retryNonce by remember { mutableStateOf(0) }
                var error by remember { mutableStateOf("") }
                val scope = rememberCoroutineScope()
                // Store-native open play: silent self-enrollment first (one isolated device
                // credential, no invitation). Transient failures (offline, rate limit, 5xx)
                // retry with backoff and then offer a manual retry; the invitation gate appears
                // ONLY when the server definitively says open enrollment is not offered (legacy deploy).
                LaunchedEffect(retryNonce) {
                    gate = "trying"
                    var attempt = 0
                    while (true) {
                        when (val r = HttpGameApi(BuildConfig.API_BASE).enrollOpen()) {
                            is HttpGameApi.OpenEnroll.Success -> { device.saveEnrollment(r.token, r.guestId, r.expiresAt); enrolled = true; break }
                            HttpGameApi.OpenEnroll.NotOffered -> { gate = "invitation"; break }
                            HttpGameApi.OpenEnroll.Transient -> {
                                attempt++
                                if (attempt >= 3) { gate = "retry"; break }
                                kotlinx.coroutines.delay(1500L * attempt)
                            }
                        }
                    }
                }
                MaterialTheme(colorScheme = darkColorScheme()) {
                    Surface(Modifier.fillMaxSize()) {
                        Column(Modifier.safeDrawingPadding().padding(24.dp), verticalArrangement = Arrangement.Center) {
                            when (gate) {
                                "trying" -> {
                                    Text("Threadly", style = MaterialTheme.typography.headlineMedium)
                                    Text("Setting up this device's private player profile...")
                                }
                                "retry" -> {
                                    Text("Threadly", style = MaterialTheme.typography.headlineMedium)
                                    Text("Could not reach the game server. Check your connection and try again.")
                                    Button(onClick = { retryNonce++ }) { Text("Try again") }
                                }
                                else -> {
                            Text("Threadly native beta", style = MaterialTheme.typography.headlineMedium)
                            Text("Synthetic test puzzles. Enter your one-time invitation. This beta expires after its test period.")
                            OutlinedTextField(value = code, onValueChange = { if (it.length <= 64) code = it }, label = { Text("Invitation") }, enabled = !busy, singleLine = true)
                            Text(error)
                            Button(enabled = !busy && code.isNotBlank(), onClick = {
                                busy = true; error = ""
                                scope.launch {
                                    try {
                                        val token = HttpGameApi(BuildConfig.API_BASE).enroll(code.trim())
                                        if (token == null) error = "Invalid or expired invitation. Check the code."
                                        else { device.saveToken(token); code = ""; enrolled = true }
                                    } catch (_: Exception) { error = "Could not enroll. Check your connection and try again." }
                                    finally { busy = false }
                                }
                            }) { Text(if (busy) "Enrolling..." else "Start beta") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
