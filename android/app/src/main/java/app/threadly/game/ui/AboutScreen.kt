package app.threadly.game.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.threadly.game.BuildConfig

/** Dialog keeps the gameplay composition alive, including its pending input. */
@Composable
fun AboutScreen(onClose: () -> Unit) {
    var sponsor by rememberSaveable { mutableStateOf(false) }
    var failedUrl by rememberSaveable { mutableStateOf<String?>(null) }
    val uri = LocalUriHandler.current
    val clipboard = LocalClipboardManager.current
    val packageName = LocalContext.current.packageName
    fun open(url: String) { runCatching { uri.openUri(url) }.onFailure { failedUrl = url } }
    Dialog(onDismissRequest = { if (sponsor) sponsor = false else onClose() }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp)) {
                TextButton(onClick = { if (sponsor) sponsor = false else onClose() }) { Text(if (sponsor) "Back to About" else "Back to Threadly") }
                Text(if (sponsor) "Support Threadly" else "About Threadly", style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(12.dp))
                if (sponsor) {
                    Text("Support for development is optional.")
                    AboutLink("Buy Me a Coffee", "buymeacoffee.com/frpboy") { open("https://buymeacoffee.com/frpboy") }
                    AboutLink("Patreon", "patreon.com/c/FrpBoy") { open("https://www.patreon.com/c/FrpBoy") }
                } else {
                    AboutLink("Developer", "Rahul Muraleedharan - https://www.frpboy.in/") { open("https://www.frpboy.in/") }
                    AboutLink("GitHub", "github.com/frpboy") { open("https://github.com/frpboy") }
                    AboutLink("LinkedIn", "linkedin.com/in/rahul-muraleedharan-it") { open("https://www.linkedin.com/in/rahul-muraleedharan-it") }
                    AboutLink("Support requests", "Telegram: FRPboy Projects") { open("https://t.me/FRPboy_Projects") }
                    AboutLink("Source / Readme", "frpboy/Threadly") { open("https://github.com/frpboy/Threadly") }
                    AboutInfo("Releases", "No published releases yet.")
                    AboutLink("Sponsor", "Support Threadly's development") { sponsor = true; failedUrl = null }
                    AboutInfo("Credits / licenses", "Built with Kotlin, Jetpack Compose and AndroidX. Dependency licenses remain with their respective projects. A project license has not yet been specified in this repository.")
                    AboutInfo("Version", "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
                    AboutInfo("Package name", packageName)
                }
                failedUrl?.let { url ->
                    Text("Couldn't open this link. You can copy it instead.", color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = { clipboard.setText(AnnotatedString(url)) }) { Text("Copy link") }
                }
            }
        }
    }
}

@Composable
private fun AboutLink(title: String, detail: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(detail, style = MaterialTheme.typography.bodyMedium)
        }
    }
    HorizontalDivider()
}

@Composable
private fun AboutInfo(title: String, detail: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 14.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(detail, style = MaterialTheme.typography.bodyMedium)
    }
    HorizontalDivider()
}
