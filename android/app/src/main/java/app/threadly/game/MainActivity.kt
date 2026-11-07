package app.threadly.game

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import app.threadly.game.data.HttpGameApi
import app.threadly.game.ui.GameScreen
import app.threadly.game.ui.GameViewModel
import java.util.UUID

class MainActivity : ComponentActivity() {
    private val vm: GameViewModel by viewModels {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T =
                GameViewModel(HttpGameApi(BuildConfig.API_BASE), guestId()) as T
        }
    }

    // Self-asserted anonymous id kept on this device only. Not an account.
    private fun guestId(): String {
        val prefs = getSharedPreferences("threadly", Context.MODE_PRIVATE)
        return prefs.getString("guest_id", null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString("guest_id", it).apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { GameScreen(vm) }
    }
}
