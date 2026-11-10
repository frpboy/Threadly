package app.threadly.game.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle

private val Bg = Color(0xFF12141C)
private val Card = Color(0xFF1E2230)

@Composable
fun GameScreen(vm: GameViewModel, onReenroll: (() -> Unit)? = null) {
    val state by vm.state.collectAsStateWithLifecycle()
    val pending by vm.pending.collectAsStateWithLifecycle()
    var confirmDiscard by remember { mutableStateOf(false) }
    var confirmEnroll by remember { mutableStateOf(false) }
    MaterialTheme(colorScheme = darkColorScheme()) {
        Column(
            Modifier.fillMaxSize().background(Bg).safeDrawingPadding()
                .verticalScroll(rememberScrollState()).padding(20.dp),
        ) {
            Text("Threadly", color = Color.White, fontSize = 28.sp, modifier = Modifier.align(Alignment.CenterHorizontally))

            onReenroll?.let { action ->
                TextButton(enabled = state !is UiState.Loading && (state !is UiState.Playing || !(state as UiState.Playing).submitting), onClick = { confirmEnroll = true }) { Text("Re-enroll") }
                if (confirmEnroll) AlertDialog(onDismissRequest = { confirmEnroll = false }, title = { Text("Use a new invitation?") },
                    text = { Text("Ask for a replacement invitation first. A successful new enrollment replaces this device credential AND any saved pending guess. The old guess may already have counted. Your existing beta progress stays on the server, but does not transfer to the new device credential.") },
                    confirmButton = { TextButton(onClick = { confirmEnroll = false; action() }) { Text("Enter new invitation") } },
                    dismissButton = { TextButton(onClick = { confirmEnroll = false }) { Text("Cancel") } })
            }
            pending?.let { saved ->
                Text("Pending guess: ${saved.text}. Its response was not confirmed.", color = Color(0xFFFFD479))
                Row {
                    TextButton(enabled = state is UiState.Playing && (state as UiState.Playing).puzzleId == saved.puzzleId && !(state as UiState.Playing).submitting, onClick = vm::retryPending) { Text("Retry same request") }
                    TextButton(enabled = state !is UiState.Loading && (state !is UiState.Playing || !(state as UiState.Playing).submitting), onClick = { confirmDiscard = true }) { Text("Discard pending") }
                }
            }
            if (confirmDiscard) AlertDialog(onDismissRequest = { confirmDiscard = false }, title = { Text("Discard uncertain guess?") },
                text = { Text("This guess may already have counted. Discarding does not undo it. Threadly will reload saved progress before you can guess again. Retrying the same request is safer if you still want its result.") },
                confirmButton = { TextButton(onClick = { confirmDiscard = false; vm.discardPending() }) { Text("Discard and reload") } },
                dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text("Cancel") } })
            Spacer(Modifier.height(12.dp))
            when (val s = state) {
                UiState.Loading -> Text("Loading today's puzzle...", color = Color(0xFFAAB0C0))
                is UiState.Error -> {
                    Text(s.message, color = Color(0xFFFFD479))
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = vm::load, modifier = Modifier.heightIn(min = 48.dp)) { Text("Retry") }
                }
                is UiState.Playing -> Playing(s, vm::submit)
                is UiState.Finished -> Finished(s)
            }
        }
    }
}

@Composable
private fun Clues(clues: List<String>) {
    clues.forEachIndexed { i, text ->
        Text(
            "${i + 1}.  $text", color = Color.White, fontSize = 20.sp,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                .background(Card, RoundedCornerShape(8.dp)).padding(12.dp),
        )
    }
}

@Composable
private fun Playing(s: UiState.Playing, onSubmit: (String) -> Unit) {
    var guess by rememberSaveable { mutableStateOf("") }
    // Keep the typed text if a submit failed; clear it only once the server shows a new clue.
    LaunchedEffect(s.progress.clues.size) { guess = "" }
    Text("Find the connection. Fewer clues, more points.", color = Color(0xFFAAB0C0))
    Spacer(Modifier.height(12.dp))
    Clues(s.progress.clues)
    if (s.progress.guesses.isNotEmpty()) {
        Text("Guesses: " + s.progress.guesses.joinToString(", "), color = Color(0xFF8890A5))
        Spacer(Modifier.height(8.dp))
    }
    OutlinedTextField(
        value = guess, onValueChange = { guess = it }, singleLine = true, enabled = !s.submitting,
        label = { Text("What connects these?") },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
        keyboardActions = KeyboardActions(onSend = { onSubmit(guess) }),
        modifier = Modifier.fillMaxWidth().semantics { contentDescription = "Your guess" }.testTag("guess_input"),
    )
    Spacer(Modifier.height(8.dp))
    Button(
        onClick = { onSubmit(guess) }, enabled = !s.submitting && guess.isNotBlank(),
        modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
    ) { Text("Guess") }
    if (s.notice.isNotEmpty()) {
        Spacer(Modifier.height(12.dp))
        Text(s.notice, color = Color(0xFFFFD479), fontSize = 16.sp,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    }
}

@Composable
private fun Finished(s: UiState.Finished) {
    Clues(s.progress.clues)
    Spacer(Modifier.height(12.dp))
    Text(s.notice, color = Color(0xFFFFD479), fontSize = 18.sp,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
}
