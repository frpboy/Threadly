package app.threadly.game.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Dedicated app-private keystore key. No exported credential, admin token, or backup. */
class DeviceCredentials(context: Context) : BetaCredentials {
    private val prefs = context.getSharedPreferences("native_beta_device", Context.MODE_PRIVATE)
    private val alias = "threadly-native-beta-device-v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (store.containsAlias(alias)) return store.getKey(alias, null) as SecretKey
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return generator.generateKey()
    }
    private fun write(value: JSONObject) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val bytes = cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
        check(prefs.edit().putString("sealed", Base64.encodeToString(bytes, Base64.NO_WRAP)).commit())
    }
    private fun read(): JSONObject {
        val encoded = prefs.getString("sealed", null) ?: return JSONObject()
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
        return JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
    }
    override fun token(): String? = try { read().optString("token").takeIf { it.matches(Regex("[A-Za-z0-9_-]{43}")) } } catch (_: Exception) { null }
    fun sessionKey(): String = java.security.MessageDigest.getInstance("SHA-256").digest((token() ?: "").toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    fun saveToken(token: String) { require(token.matches(Regex("[A-Za-z0-9_-]{43}"))); write(JSONObject().put("token", token)) }
    @Synchronized override fun requestId(puzzleId: String, guess: String): String {
        val state = read()
        if (state.has("pendingId")) {
            if (state.getString("puzzle") != puzzleId || state.getString("guess") != guess) throw PendingGuessException(state.getString("guess"))
            return state.getString("pendingId")
        }
        val id = UUID.randomUUID().toString()
        write(state.put("pendingId", id).put("puzzle", puzzleId).put("guess", guess))
        return id
    }
    @Synchronized override fun pending(): PendingGuess? {
        val state = read()
        return if (state.has("pendingId")) PendingGuess(state.getString("puzzle"), state.getString("guess"), state.getString("pendingId")) else null
    }
    @Synchronized override fun completeRequest() { val state = read(); state.remove("pendingId"); state.remove("puzzle"); state.remove("guess"); write(state) }
}
