"""Best-effort, deadline-bounded evidence from the one synthetic emulator only."""
from pathlib import Path
import subprocess

SERIAL = 'emulator-5554'
PIXELS = ('loopback-resume', 'loopback-solved', 'loopback-exhausted')


def collect(root, adb='adb', seconds=10):
    out = Path(root) / 'loopback-evidence'
    out.mkdir(exist_ok=True)
    crash = out / 'crash.txt'
    with crash.open('w') as log:
        try:
            result = subprocess.run([adb, 'devices'], capture_output=True, text=True,
                                    timeout=seconds, check=True)
        except (subprocess.SubprocessError, OSError) as error:
            log.write('Device discovery unavailable: ' + type(error).__name__ + '\n')
            return
        if [SERIAL, 'device'] not in [line.split() for line in result.stdout.splitlines()]:
            log.write('Synthetic emulator not online; no pixel, crash or kill command attempted.\n')
            return
        # Each operation has its own deadline; a failed pull must not skip crash/kill.
        for name in PIXELS:
            try:
                subprocess.run([adb, '-s', SERIAL, 'pull', '/data/local/tmp/' + name + '.png',
                                str(out / (name + '.png'))], stdout=log, stderr=log,
                               timeout=seconds, check=True)
            except (subprocess.SubprocessError, OSError) as error:
                log.write('Named capture unavailable: ' + name + ' ' + type(error).__name__ + '\n')
        try:
            subprocess.run([adb, '-s', SERIAL, 'logcat', '-d', '-b', 'crash'],
                           stdout=log, stderr=log, timeout=seconds, check=True)
        except (subprocess.SubprocessError, OSError) as error:
            log.write('Crash buffer unavailable: ' + type(error).__name__ + '\n')
        finally:
            try:
                subprocess.run([adb, '-s', SERIAL, 'emu', 'kill'], stdout=log, stderr=log,
                               timeout=seconds, check=True)
            except (subprocess.SubprocessError, OSError) as error:
                log.write('Emulator kill unavailable: ' + type(error).__name__ + '\n')


if __name__ == '__main__':
    collect(Path.cwd())
