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
    GameResult(id, day, solved, 2, if (solved) 80 else 0)

/**
 * Mirrors real SharedPreferences commit semantics (SharedPreferencesImpl): memory
 * mutates BEFORE the disk result, so a failed commit leaves the row readable in
 * this process while nothing is durable.
 */
private class PrefsLikeKv(var diskOk: Boolean = true) : StatsStore.KvStore {
    var memory: String? = null
    var disk: String? = null
    override fun read(): String? = memory
    override fun write(value: String): Boolean {
        memory = value
        if (diskOk) { disk = value; return true }
        return false
    }
}

class StatsStoreTest {

    @Test fun failedCommitMemoryRowIsRecommittedBeforeDurableSuccess() {
        val kv = PrefsLikeKv(diskOk = false)
        val store = StatsStore(kv)
        assertFalse(store.tryRecord(result("p1")))
        assertNotNull(kv.memory)   // failed commit still leaves the row visible in memory
        assertNull(kv.disk)        // but nothing is durable
        val replacement = StatsStore(kv)
        assertFalse(replacement.tryRecord(result("p1"))) // same process memory, new store
        assertNull(kv.disk)
        kv.diskOk = true
        // The in-memory duplicate must not be reported as durable: a recommit is required.
        assertTrue(replacement.tryRecord(result("p1")))
        assertNotNull(kv.disk)
        assertTrue(kv.disk!!.contains("p1"))
    }

    @Test fun semanticallyCorruptHistoryIsFailClosedAndPreserved() {
        // structurally valid JSON, semantically impossible day: date math would compute
        // garbage silently, so the whole history goes fail-closed like structural corruption
        val kv = FakeKv(data = """[{"puzzleId":"p0","day":"2026-13-40","solved":true,"cluesUsed":1,"score":100}]""")
        val store = StatsStore(kv)
        try { store.results(); fail("expected StoreException") } catch (_: StatsStore.StoreException) {}
        val sum = store.summary("2026-11-15")      // must not crash composition
        assertEquals(0, sum.played); assertEquals(0, sum.wins)
        assertFalse(store.tryRecord(result("p1"))) // fail-closed: nothing written over corrupt history
        assertTrue(kv.writes.isEmpty())
        assertTrue(kv.data!!.contains("2026-13-40")) // corrupt bytes preserved verbatim
        for (day in listOf("", "bad", "2026-02-30")) {
            val raw = """[{"puzzleId":"p0","day":"$day","solved":true,"cluesUsed":1,"score":100}]"""
            val bad = FakeKv(data = raw)
            assertEquals(0, StatsStore(bad).summary("2026-11-15").played)
            assertFalse(StatsStore(bad).tryRecord(result("p1")))
            assertEquals(raw, bad.data)
        }
    }

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

    @Test fun duplicatePuzzleIdRecommitsWithoutChangingOutcome() {
        val kv = FakeKv()
        val store = StatsStore(kv)
        assertTrue(store.tryRecord(result("p1")))
        assertTrue(store.tryRecord(result("p1", solved = false))) // replay with a different outcome
        assertEquals(2, kv.writes.size)
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
