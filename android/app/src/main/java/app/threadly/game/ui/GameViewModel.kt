package app.threadly.game.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.threadly.game.data.GameApi
import app.threadly.game.data.BetaCredentials
import app.threadly.game.data.GameResult
import app.threadly.game.data.PendingGuess
import app.threadly.game.data.ShareCard
import app.threadly.game.data.StatsStore
import app.threadly.game.data.StatsSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class GameViewModel(
    api: GameApi,
    guestId: String,
    private val device: BetaCredentials? = null,
    private val stats: StatsStore? = null,
    private val today: () -> String = {
        val c = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        "%04d-%02d-%02d".format(c.get(java.util.Calendar.YEAR), c.get(java.util.Calendar.MONTH) + 1, c.get(java.util.Calendar.DAY_OF_MONTH))
    },
) : ViewModel() {
    private val controller = GameController(api, guestId, recorder = { r: GameResult -> stats?.tryRecord(r) }, clock = today)

    /** Local stats for the finished screen; empty summary when history is unreadable or absent. */
    fun statsSummary(): StatsSummary = stats?.summary(today()) ?: StatsSummary(0, 0, 0, 0, emptyMap())

    /** Spoiler-free share text for a finished game. */
    fun shareCard(s: UiState.Finished): String = ShareCard.build(
        GameResult(
            puzzleId = s.puzzleId,
            day = today(),
            solved = s.progress.state == app.threadly.game.data.GameState.SOLVED,
            cluesUsed = s.progress.clueNumber,
            score = s.progress.score,
        ),
        totalClues = s.progress.totalClues,
    )
    private val _state = MutableStateFlow<UiState>(UiState.Loading)
    val state: StateFlow<UiState> = _state

    private var storageFailed = false
    private val storageError = "Could not safely read this device's saved request. Re-enroll with a replacement invitation. The old guess may already have counted."
    private fun readPending(): PendingGuess? = try { device?.pending() } catch (_: Exception) { storageFailed = true; null }
    private val _pending = MutableStateFlow<PendingGuess?>(readPending())
    val pending: StateFlow<PendingGuess?> = _pending
    // Deliberate user choice only. No network retry here; load must succeed before further guesses.
    fun discardPending() {
        try { device?.completeRequest() }
        catch (_: Exception) {
            _state.value = UiState.Error("Could not safely clear the pending guess. It is still saved. Retry later or re-enroll with a replacement invitation.")
            return
        }
        _pending.value = null; load()
    }
    fun retryPending() { _pending.value?.let { submit(it.text) } }
    init { load() }

    fun load() {
        if (storageFailed) { _state.value = UiState.Error(storageError); return }
        _state.value = UiState.Loading
        viewModelScope.launch { _state.value = controller.load() }
    }

    fun submit(text: String) {
        val cur = _state.value as? UiState.Playing ?: return
        if (cur.submitting || text.isBlank()) return
        _state.value = cur.copy(submitting = true)
        viewModelScope.launch {
            val result = controller.guess(cur, text)
            _pending.value = readPending()
            _state.value = if (storageFailed) UiState.Error(storageError) else result
        }
    }
}
