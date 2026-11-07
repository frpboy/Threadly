package app.threadly.game.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.threadly.game.data.GameApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class GameViewModel(api: GameApi, guestId: String) : ViewModel() {
    private val controller = GameController(api, guestId)
    private val _state = MutableStateFlow<UiState>(UiState.Loading)
    val state: StateFlow<UiState> = _state

    init { load() }

    fun load() {
        _state.value = UiState.Loading
        viewModelScope.launch { _state.value = controller.load() }
    }

    fun submit(text: String) {
        val cur = _state.value as? UiState.Playing ?: return
        if (cur.submitting || text.isBlank()) return
        _state.value = cur.copy(submitting = true)
        viewModelScope.launch { _state.value = controller.guess(cur, text) }
    }
}
