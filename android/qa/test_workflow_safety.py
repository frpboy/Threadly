"""Local negative controls for harness failures, not Android runtime qualification."""
from pathlib import Path
import os
import subprocess
import tempfile
import time
import unittest
from collect_device_evidence import collect
from stage_evidence import stage

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/android-loopback-qa.yml'


def step_script(name):
    text = WORKFLOW.read_text().split('      - name: ' + name + '\n', 1)[1]
    text = text.split('      - ', 1)[0].split('        run: |\n', 1)[1]
    return '\n'.join(line[10:] for line in text.splitlines()) + '\n'


class WorkflowSafetyTest(unittest.TestCase):
    def fake_adb(self, root, mode):
        adb = root / 'adb'
        adb.write_text('''#!/usr/bin/env python3
import sys,time
from pathlib import Path
p=Path(__file__).parent
with (p/'calls').open('a') as f:f.write(' '.join(sys.argv[1:])+'\\n')
mode=(p/'mode').read_text()
if sys.argv[1:]==['devices']:
 print('List of devices attached')
 if mode!='none':print('emulator-5554\\tdevice')
 sys.exit(0)
if mode=='hang':time.sleep(10)
if mode=='fail':sys.exit(9)
if 'pull' in sys.argv:Path(sys.argv[-1]).write_bytes(b'\\x89PNG\\r\\n\\x1a\\n')
''')
        adb.chmod(0o700); (root / 'mode').write_text(mode)
        return str(adb)

    def test_no_device_skips_all_device_commands_but_stages_unit_xml(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); collect(root,self.fake_adb(root,'none'),seconds=1.0)
            self.assertEqual(['devices'],(root/'calls').read_text().splitlines())
            units=root/'android/app/build/test-results/testQaUnitTest';units.mkdir(parents=True)
            (units/'TEST-unit.xml').write_text('<testsuite/>')
            self.assertEqual(2,len(stage(root,root/'out')))
            self.assertFalse(list((root/'out').rglob('*.png')))

    def test_hanging_and_failing_adb_are_bounded_and_kill_attempted(self):
        for mode in ('hang','fail','ok'):
            with self.subTest(mode=mode),tempfile.TemporaryDirectory() as td:
                root=Path(td); start=time.monotonic()
                collect(root,self.fake_adb(root,mode),seconds=.5)
                self.assertLess(time.monotonic()-start,8)
                calls=(root/'calls').read_text()
                self.assertEqual(3,calls.count(' pull '));self.assertIn(' logcat -d -b crash',calls)
                self.assertIn(' emu kill',calls)
                if mode=='ok':self.assertEqual(3,len(list((root/'loopback-evidence').glob('*.png'))))

    def test_discovery_itself_is_deadline_bounded(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); adb=root/'adb'
            adb.write_text('#!/usr/bin/env python3\nimport time\ntime.sleep(10)\n');adb.chmod(0o700)
            start=time.monotonic();collect(root,str(adb),seconds=1.0)
            self.assertLess(time.monotonic()-start,3)
            self.assertIn('TimeoutExpired',(root/'loopback-evidence/crash.txt').read_text())

    def test_failed_gradle_preserves_failure_and_stops_preflight(self):
        script=step_script('Compile synthetic QA and existing unit tests, inspect merged manifests')
        for code in (7,124):
            with self.subTest(code=code),tempfile.TemporaryDirectory() as td:
                root=Path(td);(root/'gradle').write_text('#!/bin/sh\necho "$@" >> "$RUNNER_TEMP/calls"\nexit '+str(code)+'\n')
                (root/'gradle').chmod(0o700)
                env=dict(os.environ,PATH=str(root)+':'+os.environ['PATH'],RUNNER_TEMP=td,JAVA_HOME_21_X64=td)
                result=subprocess.run(['bash','-c',script],cwd=root,env=env,capture_output=True,timeout=3)
                self.assertEqual(code,result.returncode)
                calls=(root/'calls').read_text();self.assertEqual(1,len(calls.splitlines()))
                self.assertIn(':app:testQaUnitTest',calls);self.assertNotIn('dependencyInsight',calls)

    def test_dependency_scope_and_every_blocking_command_has_deadline(self):
        text=WORKFLOW.read_text()
        self.assertIn(':app:dependencyInsight --configuration qaRuntimeClasspath',text)
        self.assertNotIn(' qaRuntimeClasspath --dependency',text.split(':app:dependencyInsight')[0])
        boot=step_script('Boot API36 and enforce mandatory QA-app IPv4 and IPv6 fence')
        self.assertIn('adb() { timeout --kill-after=5s 20s adb "$@"; }',boot)
        self.assertIn('deadline=$((SECONDS + 240))',boot)
        self.assertIn('-port 5554',boot);self.assertIn('ANDROID_SERIAL=emulator-5554',boot)
        for line in boot.splitlines():
            if 'sdkmanager ' in line or 'avdmanager ' in line:self.assertIn('timeout --kill-after=',line)
            if 'wait-for-device' in line:self.assertIn('timeout --kill-after=',line)
        self.assertIn('timeout --kill-after=10s 600s gradle --max-workers=2 -Pkotlin.compiler.execution.strategy=in-process',step_script('Run all QA instrumentation and require exact discovery counts'))
        cleanup=text.split('      - name: Collect named failure or success pixels',1)[1].split('      - name:',1)[0]
        self.assertIn('if: always()',cleanup);self.assertIn('timeout-minutes: 2',cleanup)
        self.assertNotIn('continue-on-error',text)
        self.assertIn("if: always() && steps.evidence_bound.outcome == 'success'",text)


if __name__=='__main__':unittest.main()
