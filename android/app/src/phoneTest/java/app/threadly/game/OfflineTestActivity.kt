package app.threadly.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import org.json.JSONArray

class OfflineTestActivity : ComponentActivity() {
    private val vm: GameViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                val prefs = getSharedPreferences("offline-sample", MODE_PRIVATE)
                val array = runCatching { JSONArray(prefs.getString("guesses", "[]")) }.getOrDefault(JSONArray())
                val initial = (0 until array.length()).map { array.getString(it) }
                val api = OfflineGameApi(initial) { prefs.edit().putString("guesses", JSONArray(it).toString()).commit() }
                return GameViewModel(api, "local-sample") as T
            }
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Column(Modifier.fillMaxSize().safeDrawingPadding()) {
                    Text("OFFLINE TEST - one sample, no live server", Modifier.padding(12.dp))
                    Button(onClick = {
                        getSharedPreferences("offline-sample", MODE_PRIVATE).edit().clear().commit()
                        viewModelStore.clear()
                        recreate()
                    }, modifier = Modifier.padding(horizontal = 12.dp)) { Text("Reset sample") }
                    Box(Modifier.weight(1f)) { GameScreen(vm) }
                }
            }
        }
    }
}
