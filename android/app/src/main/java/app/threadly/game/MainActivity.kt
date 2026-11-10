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
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val device = DeviceCredentials(this)
        setContent {
            var enrolled by remember { mutableStateOf(device.token() != null) }
            if (enrolled) {
                val vm: GameViewModel = viewModel(key = "beta-" + device.sessionKey(), factory = object : ViewModelProvider.Factory {
                    @Suppress("UNCHECKED_CAST")
                    override fun <T : ViewModel> create(modelClass: Class<T>): T =
                        GameViewModel(HttpGameApi(BuildConfig.API_BASE, device), "server-owned-device", device) as T
                })
                GameScreen(vm, onReenroll = { enrolled = false })
            } else {
                var code by remember { mutableStateOf("") }
                var busy by remember { mutableStateOf(false) }
                var error by remember { mutableStateOf("") }
                val scope = rememberCoroutineScope()
                MaterialTheme(colorScheme = darkColorScheme()) {
                    Surface(Modifier.fillMaxSize()) {
                        Column(Modifier.safeDrawingPadding().padding(24.dp), verticalArrangement = Arrangement.Center) {
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
