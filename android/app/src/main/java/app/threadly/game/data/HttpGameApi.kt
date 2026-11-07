package app.threadly.game.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class HttpGameApi(private val baseUrl: String) : GameApi {
    private class Resp(val code: Int, val json: JSONObject?)

    /** One retry on 5xx or IO error: /api/daily was seen returning 500 on a cold start. 4xx is never retried. */
    private suspend fun call(method: String, path: String, body: JSONObject?): Resp = withContext(Dispatchers.IO) {
        var last: IOException? = null
        for (attempt in 0..1) {
            try {
                val r = once(method, path, body)
                if (r.code >= 500 && attempt == 0) continue
                return@withContext r
            } catch (e: IOException) { last = e }
        }
        throw last ?: IOException("request failed")
    }

    private fun once(method: String, path: String, body: JSONObject?): Resp {
        val c = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            c.connectTimeout = 10_000; c.readTimeout = 15_000
            c.requestMethod = method
            c.setRequestProperty("Accept", "application/json")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = c.responseCode
            val stream = if (code >= 400) c.errorStream else c.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = try { JSONObject(text) } catch (e: Exception) { null }
            return Resp(code, json)
        } finally { c.disconnect() }
    }

    override suspend fun daily(): Daily? {
        val r = call("GET", "/api/daily", null)
        val j = r.json ?: return null
        if (r.code != 200) return null
        return Daily(j.getString("puzzle_id"), j.optString("title"), j.optInt("total_clues", 5))
    }

    override suspend fun progress(puzzleId: String, guestId: String): Progress? {
        val r = call("POST", "/api/progress", JSONObject().put("puzzle_id", puzzleId).put("guest_id", guestId))
        val j = r.json ?: return null
        return if (r.code == 200) Progress.parse(j) else null
    }

    // The client never sends a clue count: the server derives it from its own guess log.
    override suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome =
        GuessOutcome(call("POST", "/api/guess",
            JSONObject().put("puzzle_id", puzzleId).put("guess", text).put("guest_id", guestId)).code)
}
