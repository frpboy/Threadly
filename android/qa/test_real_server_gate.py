"""Source/harness negative controls only. Does not claim a live DB/emulator run."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from real_server_gate import guard, ready, stop, ticks

PASSWORD = 'a' * 48
URL = 'postgresql://gate:' + PASSWORD + '@127.0.0.1:5432/threadly_android_gate'
ROOT = Path(__file__).resolve().parents[2]


class RealGateTest(unittest.TestCase):
    def test_url_is_exact_local_disposable_database(self):
        guard({'DATABASE_URL': URL, 'THREADLY_GATE_PASSWORD': PASSWORD})
        for url in (URL.replace('127.0.0.1','example.org'),URL.replace('threadly_android_gate','production'),
                    URL+'?schema=other',URL+'#other',URL.replace('5432','5433'),URL.replace('gate:','owner:'),''):
            with self.subTest(url=url),self.assertRaises(ValueError):guard({'DATABASE_URL':url,'THREADLY_GATE_PASSWORD':PASSWORD})
        for key in ('NODE_OPTIONS','NODE_PATH'):
            with self.assertRaises(ValueError):guard({'DATABASE_URL':URL,'THREADLY_GATE_PASSWORD':PASSWORD,key:'preload'})

    def test_absent_server_is_readiness_timeout_not_success(self):
        start=time.monotonic()
        with self.assertRaises(TimeoutError):ready(port=1,seconds=.1)
        self.assertLess(time.monotonic()-start,3)

    def test_pid_reuse_or_other_process_group_never_killed(self):
        with tempfile.TemporaryDirectory() as td:
            state=Path(td)/'server.json'
            state.write_text(json.dumps({'pid':os.getpid(),'start_ticks':'invalid'}))
            with self.assertRaises(ValueError):stop(state)
            self.assertFalse(state.exists())

    def test_owned_stubborn_server_is_killed_bounded(self):
        with tempfile.TemporaryDirectory() as td:
            child=subprocess.Popen(['python3','-c','import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(60)'],start_new_session=True)
            state=Path(td)/'server.json';state.write_text(json.dumps({'pid':child.pid,'start_ticks':ticks(child.pid)}))
            time.sleep(.1);start=time.monotonic()
            try:stop(state);child.wait(timeout=2)
            finally:
                if child.poll() is None:child.kill();child.wait()
            self.assertLess(time.monotonic()-start,8);self.assertFalse(state.exists())

    def test_scope_isolation_and_live_test_filters(self):
        real=(ROOT/'.github/workflows/android-real-server-qa.yml').read_text()
        synthetic=(ROOT/'.github/workflows/android-loopback-qa.yml').read_text()
        self.assertIn('class=app.threadly.game.RealServerUiTest ',real)
        self.assertIn('class=app.threadly.game.GameScreenTest,app.threadly.game.LoopbackHttpUiTest ',synthetic)
        lifecycle=(ROOT/'android/qa/local_postgres.py').read_text()
        self.assertIn('127.0.0.1:5432:5432',lifecycle)
        self.assertIn('postgres:16@sha256:',lifecycle)
        self.assertNotIn('services:',real)
        self.assertIn('local_postgres.py stop',real)
        self.assertNotIn('secrets.',real);self.assertNotIn('preload',real)
        self.assertIn('reverse tcp:8765 tcp:3189',real)
        self.assertIn('reverse --remove tcp:8765',real)
        self.assertIn('len(cases)==4',real);self.assertIn('len(cases)==12',synthetic)
        self.assertIn("steps.evidence_bound.outcome == 'success'",real)
        db=(ROOT/'android/qa/real_db_gate.cjs').read_text()
        for token in ('guesses_puzzle_player_clue_uq','database must be empty','gamesPlayed,1','scores[0].score,80','db.guess.count(),8'):
            self.assertIn(token,db)
        self.assertNotIn('deleteMany',db)


if __name__ == '__main__': unittest.main()
