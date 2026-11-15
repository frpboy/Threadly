package app.threadly.game.data

/**
 * Local, on-device statistics for finished daily games (PRD V1: no account needed,
 * progress tracked locally). The server stays the gameplay authority; this only
 * records outcomes the server already finalized.
 */

/** One finished daily game. [day] is the puzzle's UTC date, ISO yyyy-MM-dd. */
data class GameResult(
    val puzzleId: String,
    val day: String,
    val solved: Boolean,
    val cluesUsed: Int,
    val score: Int,
)

data class StatsSummary(
    val played: Int,
    val wins: Int,
    val currentStreak: Int,
    val maxStreak: Int,
    /** clues used at solve time -> number of solves. Only solved games appear. */
    val clueDistribution: Map<Int, Int>,
) {
    /** Whole percent, 0 when nothing played. */
    val winRate: Int get() = if (played == 0) 0 else wins * 100 / played
}

object LocalStats {

    /** True only for a real calendar date in yyyy-MM-dd form (leap-year aware). "2026-02-30" or "2026-13-01" is false. */
    fun isValidIsoDay(iso: String): Boolean {
        if (!iso.matches(Regex("""\d{4}-\d{2}-\d{2}"""))) return false
        val y = iso.substring(0, 4).toInt()
        val m = iso.substring(5, 7).toInt()
        val d = iso.substring(8, 10).toInt()
        if (m < 1 || m > 12) return false
        val leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
        val dim = intArrayOf(31, if (leap) 29 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
        return d in 1..dim[m - 1]
    }

    /**
     * Days from 1970-01-01 for an ISO yyyy-MM-dd date (Howard Hinnant's
     * days-from-civil). Pure arithmetic so it works on minSdk 24 without
     * java.time desugaring.
     */
    fun dayNumber(iso: String): Long {
        val y = iso.substring(0, 4).toInt()
        val m = iso.substring(5, 7).toInt()
        val d = iso.substring(8, 10).toInt()
        val yy = if (m <= 2) y - 1 else y
        val era = Math.floorDiv(yy.toLong(), 400)
        val yoe = yy - era * 400 // [0, 399]
        val mp = (m + 9) % 12    // [0, 11], March = 0
        val doy = (153 * mp + 2) / 5 + d - 1
        val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    fun isoFromDayNumber(z: Long): String {
        val zz = z + 719468
        val era = Math.floorDiv(zz, 146097)
        val doe = zz - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val y = yoe + era * 400
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = doy - (153 * mp + 2) / 5 + 1
        val m = if (mp < 10) mp + 3 else mp - 9
        val yy = if (m <= 2) y + 1 else y
        return "%04d-%02d-%02d".format(yy, m, d)
    }

    /**
     * First result per puzzleId wins; the server finalizes a daily game once, so a
     * duplicate id is a resume or replay, never a new outcome.
     */
    fun dedup(results: List<GameResult>): List<GameResult> {
        val seen = HashSet<String>()
        return results.filter { seen.add(it.puzzleId) }
    }

    /**
     * Streak rules (game rules doc): a streak is consecutive UTC days with a solve.
     * It is alive only when the latest solve is today or yesterday; a missed day
     * resets it to 0. Failed days do not add to a streak.
     */
    fun summarize(results: List<GameResult>, today: String): StatsSummary {
        val games = dedup(results)
        val solvedDays = games.filter { it.solved }.map { dayNumber(it.day) }.distinct().sorted()
        var maxStreak = 0
        var run = 0
        var prev = Long.MIN_VALUE
        for (day in solvedDays) {
            run = if (day == prev + 1) run + 1 else 1
            if (run > maxStreak) maxStreak = run
            prev = day
        }
        val todayNum = dayNumber(today)
        val last = solvedDays.lastOrNull()
        val currentStreak = when {
            last == null -> 0
            last == todayNum || last == todayNum - 1 -> {
                var count = 1
                var i = solvedDays.size - 2
                while (i >= 0 && solvedDays[i] == last - count) { count++; i-- }
                count
            }
            else -> 0
        }
        val distribution = games.filter { it.solved }
            .groupingBy { it.cluesUsed }.eachCount().toSortedMap()
        return StatsSummary(
            played = games.size,
            wins = games.count { it.solved },
            currentStreak = currentStreak,
            maxStreak = maxStreak,
            clueDistribution = distribution,
        )
    }
}
