"""Own one ephemeral loopback PostgreSQL container and never persist credentials in source/logs."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

IMAGE = 'postgres:16@sha256:f9a7b9ebf6f56201f949db745e47bc423c0f0f8294bafe991cc10bf74b029657'
DB = 'threadly_android_gate'
USER = 'gate'


def command(args, seconds=20):
    # Capture docker output because daemon errors can include configuration. Do not echo it.
    result = subprocess.run(args, capture_output=True, timeout=seconds)
    if result.returncode:
        raise RuntimeError('owned local container command failed')
    return result.stdout.decode().strip()


def load(path):
    path = Path(path)
    if path.is_symlink() or path.stat().st_mode & 0o077:
        raise ValueError('unsafe local credential file permissions')
    data = json.loads(path.read_text())
    if data['database'] != DB or data['user'] != USER or not secrets.compare_digest(data['container'], container_name()):
        raise ValueError('unexpected local database owner')
    if len(data['password']) != 48 or any(c not in '0123456789abcdef' for c in data['password']):
        raise ValueError('invalid ephemeral database credential')
    return data


def container_name():
    run = os.environ.get('GITHUB_RUN_ID', '')
    attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '')
    if not run.isdecimal() or not attempt.isdecimal():
        raise ValueError('missing exact workflow ownership')
    return 'threadly-gate-' + run + '-' + attempt


def start(path):
    path = Path(path)
    if path.exists(): raise ValueError('local database already owned')
    data = {'database': DB, 'user': USER, 'password': secrets.token_hex(24),
            'auth': secrets.token_hex(32), 'container': container_name()}
    # GitHub mask control records are emitted before any child can log a value.
    print('::add-mask::' + data['password'], flush=True)
    print('::add-mask::' + data['auth'], flush=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream: json.dump(data, stream)
    envfile = path.with_suffix('.container-env')
    try:
        fd = os.open(envfile, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write('POSTGRES_USER=' + USER + '\nPOSTGRES_DB=' + DB + '\nPOSTGRES_PASSWORD=' + data['password'] + '\n')
        command(['docker', 'run', '-d', '--name', data['container'], '--label', 'threadly.qa.owner=' + data['container'],
                 '-p', '127.0.0.1:5432:5432', '--env-file', str(envfile), IMAGE], seconds=90)
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            try:
                command(['docker', 'exec', data['container'], 'pg_isready', '-U', USER, '-d', DB], seconds=3)
                print('PASS owned disposable PostgreSQL ready on loopback')
                return
            except (RuntimeError, subprocess.TimeoutExpired): time.sleep(1)
        raise TimeoutError('local database readiness failed')
    except BaseException:
        stop(path)
        raise
    finally:
        envfile.unlink(missing_ok=True)


def environment(path):
    data = load(path)
    env = os.environ.copy()
    if env.get('NODE_OPTIONS') or env.get('NODE_PATH'):
        raise ValueError('Node injection configuration forbidden')
    env.update(DATABASE_URL='postgresql://' + USER + ':' + data['password'] + '@127.0.0.1:5432/' + DB,
               THREADLY_GATE_PASSWORD=data['password'], AUTH_SECRET=data['auth'], AUTH_TRUST_HOST='true', NEXT_TELEMETRY_DISABLED='1')
    return env


def stop(path):
    path = Path(path)
    if not path.exists(): return
    data = load(path)
    removed = False
    try:
        owner = command(['docker', 'inspect', '--format', '{{index .Config.Labels "threadly.qa.owner"}}', data['container']])
        if owner != data['container']: raise ValueError('container ownership mismatch')
        command(['docker', 'rm', '--force', data['container']])
        removed = True
        print('PASS removed exact owned disposable PostgreSQL container')
    except RuntimeError:
        # Missing container after a failed start is expected; distinguish from an existing foreign container.
        ids = command(['docker', 'ps', '-aq', '--filter', 'name=^/' + data['container'] + '$'])
        if ids: raise
        removed = True
    finally:
        path.with_suffix('.container-env').unlink(missing_ok=True)
        if removed: path.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        mode, path = sys.argv[1:3]
        if mode == 'start': start(path)
        elif mode == 'stop': stop(path)
        elif mode == 'exec':
            if not sys.argv[3:]: raise ValueError('missing child command')
            result = subprocess.run(sys.argv[3:], env=environment(path))
            sys.exit(result.returncode)
        else: raise ValueError('unknown container lifecycle mode')
    except Exception as error:
        # Never render exception message/args: subprocess errors and URLs may contain credentials.
        print('Local database lifecycle failed: ' + type(error).__name__, file=sys.stderr)
        sys.exit(1)
