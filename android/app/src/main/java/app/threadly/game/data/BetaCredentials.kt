package app.threadly.game.data

data class PendingGuess(val puzzleId: String, val text: String, val requestId: String)
interface BetaCredentials {
    fun token(): String?
    /** Server-issued player ID, when the enrollment path returned one (open store-native play). */
    fun playerId(): String? = null
    /** Durable before network send; same uncertain guess keeps its request ID across process death. */
    fun requestId(puzzleId: String, guess: String): String
    fun completeRequest()
    fun pending(): PendingGuess?
}
class PendingGuessException(val pendingGuess: String) : java.io.IOException("A previous guess is awaiting confirmation")
class AccessDeniedException : java.io.IOException("Beta access expired or revoked")
