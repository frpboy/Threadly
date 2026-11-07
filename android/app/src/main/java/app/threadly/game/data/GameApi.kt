package app.threadly.game.data

import java.io.IOException

/** The only backend surface the app uses: public player endpoints. No admin routes, no secrets. */
interface GameApi {
    @Throws(IOException::class) suspend fun daily(): Daily?
    @Throws(IOException::class) suspend fun progress(puzzleId: String, guestId: String): Progress?
    @Throws(IOException::class) suspend fun guess(puzzleId: String, guestId: String, text: String): GuessOutcome
}
