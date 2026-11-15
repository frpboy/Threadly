package app.threadly.game

import app.threadly.game.data.GameResult
import app.threadly.game.data.StatsStore
import org.junit.Assert.*
import org.junit.Test

/** In-memory KvStore that can simulate commit failure and pre-corrupted data. */
private class FakeKv(var data: String? = null, var writeOk: Boolean = true) : StatsStore.KvStore {
    val writes = mutableListOf<String>()
    override fun read(): String? = data
    override fun write(value: String): Boolean {
        if (!writeOk) return false
        data = value; writes += value; return true
    }
}

private fun result(id: String, day: String = "2026-11-15", solved: Boolean = true) =
    GameResult(id, day, solved, 2, 80)

class StatsStoreTest {

    @Test fun recordPersistsAcrossInstancesRestart() {
        val kv = FakeKv()
        assertTrue(StatsStore(kv).tryRecord(result("p1")))
        // a new instance over the same backing store = process restart
        val after = StatsStore(kv)
        assertEquals(1, after.results().size)
        assertEquals("p1", after.results()[0].puzzleId)
        assertEquals(1, after.summary("2026-11-15").played)
    }

    @Test fun commitFailureReturnsFalseAndWritesNothing() {
        val kv = FakeKv(writeOk = false)
        assertFalse(StatsStore(kv).tryRecord(result("p1")))
        assertNull(kv.data); assertTrue(kv.writes.isEmpty())
        // a later store with working storage still records the result (retry path)
        kv.writeOk = true
        assertTrue(StatsStore(kv).tryRecord(result("p1")))
    }

    @Test fun corruptHistoryFailsClosedAndIsNotWiped() {
        val kv = FakeKv(data = "{not json")
        val store = StatsStore(kv)
        assertFalse(store.tryRecord(result("p1")))
        assertEquals("{not json", kv.data) // history preserved, never overwritten
        assertEquals(0, store.summary("2026-11-15").played) // degrades, never throws
    }

    @Test fun corruptThenRepairedHistoryRecordsAgain() {
        val kv = FakeKv(data = "{not json")
        assertFalse(StatsStore(kv).tryRecord(result("p1")))
        kv.data = null // user cleared app data, or the file recovered
        assertTrue(StatsStore(kv).tryRecord(result("p1")))
    }

    @Test fun duplicatePuzzleIdIsIdempotentTrueWithoutSecondWrite() {
        val kv = FakeKv()
        val store = StatsStore(kv)
        assertTrue(store.tryRecord(result("p1")))
        assertTrue(store.tryRecord(result("p1", solved = false))) // replay with a different outcome
        assertEquals(1, kv.writes.size)
        assertTrue(store.results()[0].solved) // first outcome stands
    }

    @Test fun readFailureIsStoreExceptionNotCrash() {
        val kv = object : StatsStore.KvStore {
            override fun read(): String? = throw RuntimeException("io")
            override fun write(value: String) = true
        }
        val store = StatsStore(kv)
        assertFalse(store.tryRecord(result("p1")))
        assertEquals(0, store.summary("2026-11-15").played)
    }
}
