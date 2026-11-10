package app.threadly.game.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.json.JSONException
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class HttpGameApi(private val baseUrl: String, private val device: BetaCredentials? = null) : GameApi {
    private class Resp(val code: Int, val json: JSONObject?)

    /** Retry only reads. Guess POST may already have committed when its response fails. */
    private suspend fun call(method: String, path: String, body: JSONObject?): Resp = withContext(Dispatchers.IO) {
        var last: IOException? = null
        val retries = if (method == "GET" || path == "/api/progress") 1 else 0
        for (attempt in 0..retries) {
            try {
                val r = once(method, path, body)
                if (r.code >= 500 && attempt < retries) continue
                return@withContext r
            } catch (e: AccessDeniedException) { throw e } catch (e: IOException) { last = e }
        }
        throw last ?: IOException("request failed")
    }

    private fun once(method: String, path: String, body: JSONObject?): Resp {
        val c = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 10_000; c.readTimeout = 15_000
            c.requestMethod = method
            c.instanceFollowRedirects = false // Never forward a device credential to another host.
            c.setRequestProperty("Accept", "application/json")
            device?.token()?.let { c.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                // Streaming avoids HttpURLConnection silently replaying a buffered POST after response loss.
                c.setFixedLengthStreamingMode(bytes.size)
                c.outputStream.use { it.write(bytes) }
            }
            val code = c.responseCode
            if (device != null && code == 401) throw AccessDeniedException()
            val stream = if (code >= 400) c.errorStream else c.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = try { JSONObject(text) } catch (e: Exception) { null }
            return Resp(code, json)
        } finally { c.disconnect() }
    }

    suspend fun enroll(code: String): String? {
        val r = call("POST", "/api/beta/enroll", JSONObject().put("code", code))
        return if (r.code == 200) r.json?.optString("token")?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{43}")) } else null
    }

    override suspend fun daily(): Daily? {
        val r = call("GET", "/api/daily", null)
        val j = r.json ?: return null
        if (r.code != 200) return null
        return try {
            Daily(j.getString("puzzle_id"), j.optString("title"), j.optInt("total_clues", 5))
        } catch (_: JSONException) { throw IOException("Invalid puzzle response") }
    }

    override suspend fun progress(puzzleId: String, guestId: String): Progress? {
        val r = call("POST", "/api/progress", JSONObject().put("puzzle_id", puzzleId).put("guest_id", guestId))
        val j = r.json ?: return null
        return if (r.code == 200) {
            try { Progress.parse(j) } catch (_: JSONException) { throw IOException("Invalid progress response") }
        } else null
    }

    // The client never sends a clue count: the server derives it from its own guess log.
    override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome {
        val body = JSONObject().put("puzzle_id", puzzleId).put("guess", text).put("guest_id", guestId)
        try { device?.let { body.put("request_id", it.requestId(puzzleId, text)) } }
        catch (e: PendingGuessException) { throw e }
        catch (e: Exception) { throw IOException("Could not save request safely", e) }
        val response = call("POST", "/api/guess", body)
        if (device != null && response.code == 200) {
            val json = response.json ?: throw IOException("Invalid guess response; request remains pending")
            val clues = json.opt("clues_used")
            val score = json.opt("score_awarded")
            if (json.opt("correct") !is Boolean || clues !is Number || clues.toDouble() != clues.toInt().toDouble() || clues.toInt() !in 1..5 ||
                score !is Number || score.toDouble() != score.toInt().toDouble() || score.toInt() < 0) {
                throw IOException("Invalid guess response; request remains pending")
            }
        }
        // Only a confirmed committed result clears the durable request. No implicit retry on failure.
        if (response.code == 200 || (response.code == 409 && (response.json?.optBoolean("already_solved") == true || response.json?.optBoolean("exhausted") == true))) {
            try { device?.completeRequest() } catch (e: Exception) { throw IOException("Could not confirm saved request", e) }
        }
        return GuessOutcome(response.code)
    }
}
