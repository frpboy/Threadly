package app.threadly.game

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import app.threadly.game.data.DeviceCredentials
import app.threadly.game.data.PendingGuessException
import org.junit.Assert.*
import org.junit.Test

class DeviceCredentialsTest {
    @Test fun tokenAndPendingGuessSurviveRecreationWithoutPlaintextPreferences() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        check(android.os.Process.myUid().toString()==InstrumentationRegistry.getArguments().getString("qaUid"))
        check(context.packageName.endsWith(".qa")) { "This test may only clear QA storage" }
        val prefs = context.getSharedPreferences("native_beta_device", Context.MODE_PRIVATE)
        check(prefs.edit().clear().commit())
        try {
            val token = android.util.Base64.encodeToString(ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }, android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
            val first = DeviceCredentials(context); first.saveToken(token)
            val id = first.requestId("synthetic-puzzle", "synthetic-wrong")
            val recreated = DeviceCredentials(context)
            assertTrue(token == recreated.token()); assertEquals(id, recreated.requestId("synthetic-puzzle", "synthetic-wrong"))
            try { recreated.requestId("synthetic-puzzle", "changed"); fail("Expected pending guard") } catch (_: PendingGuessException) {}
            assertEquals(id, recreated.pending()?.requestId)
            assertFalse(prefs.all.toString().contains(token)); assertFalse(prefs.all.toString().contains("synthetic-wrong"))
            recreated.completeRequest(); assertNull(DeviceCredentials(context).pending()); assertTrue(token == DeviceCredentials(context).token())
        } finally { check(prefs.edit().clear().commit()) }
    }
}
