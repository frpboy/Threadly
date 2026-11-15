package app.threadly.game

import app.threadly.game.data.GameResult
import app.threadly.game.data.LocalStats
import org.junit.Assert.*
import org.junit.Test

private fun r(id: String, day: String, solved: Boolean = true, clues: Int = 3, score: Int = 60) =
    GameResult(id, day, solved, clues, score)

class LocalStatsTest {

    @Test fun dayNumberRoundTripsAcrossMonthAndYearBoundaries() {
        for (iso in listOf("1970-01-01", "2026-11-15", "2024-02-29", "2000-12-31", "1999-03-01")) {
            assertEquals(iso, LocalStats.isoFromDayNumber(LocalStats.dayNumber(iso)))
        }
        assertEquals(0, LocalStats.dayNumber("1970-01-01"))
        assertEquals(LocalStats.dayNumber("2026-11-15") + 1, LocalStats.dayNumber("2026-11-16"))
        // Feb 28 -> Mar 1 is one day in a non-leap year, two in a leap year
        assertEquals(LocalStats.dayNumber("2026-02-28") + 1, LocalStats.dayNumber("2026-03-01"))
        assertEquals(LocalStats.dayNumber("2024-02-28") + 2, LocalStats.dayNumber("2024-03-01"))
    }

    @Test fun emptyHistoryIsAllZero() {
        val s = LocalStats.summarize(emptyList(), "2026-11-15")
        assertEquals(0, s.played); assertEquals(0, s.wins); assertEquals(0, s.currentStreak)
        assertEquals(0, s.maxStreak); assertEquals(0, s.winRate); assertTrue(s.clueDistribution.isEmpty())
    }

    @Test fun firstResultPerPuzzleWinsOnResumeOrReplay() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-15", solved = true, clues = 2, score = 80),
                   r("p1", "2026-11-15", solved = false, clues = 5, score = 0)),
            "2026-11-15",
        )
        assertEquals(1, s.played); assertEquals(1, s.wins); assertEquals(100, s.winRate)
        assertEquals(mapOf(2 to 1), s.clueDistribution)
    }

    @Test fun consecutiveSolvedDaysBuildStreak() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-13"), r("p2", "2026-11-14"), r("p3", "2026-11-15")),
            "2026-11-15",
        )
        assertEquals(3, s.currentStreak); assertEquals(3, s.maxStreak)
    }

    @Test fun streakSurvivesUntilEndOfTodayWhenYesterdayWasLastSolve() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-13"), r("p2", "2026-11-14")),
            "2026-11-15",
        )
        assertEquals(2, s.currentStreak)
    }

    @Test fun missedDayResetsCurrentStreakButKeepsMax() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-10"), r("p2", "2026-11-11"), r("p3", "2026-11-12")),
            "2026-11-15",
        )
        assertEquals(0, s.currentStreak); assertEquals(3, s.maxStreak)
    }

    @Test fun failedDayBreaksStreak() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-13"), r("p2", "2026-11-14", solved = false, clues = 5, score = 0), r("p3", "2026-11-15")),
            "2026-11-15",
        )
        assertEquals(1, s.currentStreak); assertEquals(1, s.maxStreak)
        assertEquals(3, s.played); assertEquals(2, s.wins); assertEquals(66, s.winRate)
        // only solved games appear in the clue distribution
        assertEquals(mapOf(3 to 2), s.clueDistribution)
    }

    @Test fun monthBoundaryStreakIsConsecutive() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-10-31"), r("p2", "2026-11-01")),
            "2026-11-01",
        )
        assertEquals(2, s.currentStreak)
    }

    @Test fun duplicateSolveDaysCountOnce() {
        val s = LocalStats.summarize(
            listOf(r("p1", "2026-11-15"), r("p2", "2026-11-15")),
            "2026-11-15",
        )
        assertEquals(1, s.currentStreak); assertEquals(2, s.wins)
    }
}
