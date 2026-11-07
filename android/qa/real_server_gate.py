"""Bounded runner-local actual Next server lifecycle. Never use an external DB."""
import json
import os
from pathlib import Path
import signal
import socket
import urllib.error
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urlparse


def guard(env):
    u = urlparse(env.get('DATABASE_URL', ''))
    if (u.scheme, u.hostname, u.port, u.path, u.username, u.password, u.query, u.fragment) != (
            'postgresql', '127.0.0.1', 5432, '/threadly_android_gate', 'gate', 'disposable-local-only', '', ''):
        raise ValueError('not the dedicated disposable local database')
    if env.get('NODE_OPTIONS') or env.get('NODE_PATH'):
        raise ValueError('Node preload/alternate module paths forbidden')


def ticks(pid):
    return Path('/proc/' + str(pid) + '/stat').read_text().rsplit(')', 1)[1].split()[19]


def stop(state):
    state = Path(state)
    if not state.exists():
        return
    data = json.loads(state.read_text()); pid = data['pid']
    try:
        if ticks(pid) != data['start_ticks'] or os.getpgid(pid) != pid:
            raise ValueError('refusing to kill a different process')
        os.killpg(pid, signal.SIGTERM)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try: os.kill(pid, 0)
            except ProcessLookupError: return
            time.sleep(.1)
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    finally:
        state.unlink(missing_ok=True)


def ready(port=3189, seconds=45):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:' + str(port) + '/api/daily', timeout=2) as r:
                body = json.load(r)
                if r.status == 200 and body.get('puzzle_id') == '00000000-0000-4000-8000-000000000010':
                    assert 'answer' not in body
                    return
        except (OSError, ValueError):
            pass
        time.sleep(.3)
    raise TimeoutError('actual Next daily readiness failed')


def start(root, state):
    guard(os.environ); root = Path(root).resolve(); state = Path(state)
    if state.exists(): raise ValueError('existing server ownership record')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 3189))  # Fail rather than accepting another service.
    log = state.with_suffix('.log').open('wb')
    command = ['node', str(root / 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', '3189']
    p = subprocess.Popen(command, cwd=root / 'apps/web', env=os.environ.copy(), stdout=log, stderr=log, start_new_session=True)
    log.close()
    state.write_text(json.dumps({'pid': p.pid, 'start_ticks': ticks(p.pid)}))
    try:
        ready()
        if p.poll() is not None: raise RuntimeError('Next exited after readiness')
        request = urllib.request.Request('http://127.0.0.1:3189/api/progress', data=b'{"puzzle_id":{}}', headers={'Content-Type': 'application/json'})
        try:
            urllib.request.urlopen(request, timeout=3)
            raise AssertionError('invalid progress request was accepted')
        except urllib.error.HTTPError as error:
            assert error.code == 400 and error.headers.get('Cache-Control') == 'private, no-store'
        print('PASS actual Next readiness, seeded daily, real invalid-request guard, no preload')
    except BaseException:
        stop(state)
        raise


if __name__ == '__main__':
    if sys.argv[1] == 'stop': stop(sys.argv[2])
    elif sys.argv[1] == 'start': start(Path.cwd(), sys.argv[2])
    else: raise ValueError('unknown mode')
