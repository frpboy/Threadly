import pathlib
import subprocess
import sys
import tempfile
import unittest
from parse_uid import parse_uid
from stage_evidence import stage

class HelpersTest(unittest.TestCase):
    def test_uid_positive(self):
        self.assertEqual(10123, parse_uid("package:com.frpboy.threadly.qa uid:10123\r\n"))
    def test_uid_missing_multiple_malformed_wrong_and_privileged(self):
        for text in ("", "package:com.frpboy.threadly.qa uid:10123\n"*2,
                     "package:com.frpboy.threadly.qa uid:abc", "package:other uid:10123",
                     "package:com.frpboy.threadly.qa uid:0", "package:com.frpboy.threadly.qa uid:10123 extra"):
            with self.subTest(text=text), self.assertRaises(ValueError): parse_uid(text)
    def test_uid_shell_failure_stops_before_firewall(self):
        parser = pathlib.Path(__file__).with_name("parse_uid.py")
        script = 'set -euo pipefail; if ! QA_UID=$(python3 "$1"); then exit 1; fi; printf FIREWALL_REACHED'
        for text in ("", "package:com.frpboy.threadly.qa uid:no", "package:other uid:10123", "package:com.frpboy.threadly.qa uid:10123\n"*2):
            result = subprocess.run(['bash','-c',script,'bash',str(parser)],input=text,text=True,capture_output=True)
            self.assertNotEqual(0,result.returncode); self.assertNotIn('FIREWALL_REACHED',result.stdout)
    def test_stage_excludes_gradle_binary_and_unnamed_files(self):
        with tempfile.TemporaryDirectory() as td:
            root=pathlib.Path(td); units=root/'android/app/build/test-results/testQaUnitTest'; units.mkdir(parents=True)
            (units/'TEST-fixture.xml').write_text('<testsuite/>'); (units/'output.bin').write_bytes(b'internal')
            shots=root/'loopback-evidence'; shots.mkdir(); (shots/'crash.txt').write_text('synthetic'); (shots/'unapproved.txt').write_text('exclude')
            files=stage(root,root/'out'); self.assertEqual(2,len(files)); self.assertFalse((root/'out/output.bin').exists())
    def test_stage_cap_and_symlink_fail(self):
        for kind in ('cap','symlink'):
            with self.subTest(kind=kind),tempfile.TemporaryDirectory() as td:
                root=pathlib.Path(td); shots=root/'loopback-evidence';shots.mkdir(); p=shots/'crash.txt'
                if kind=='cap':
                    with p.open('wb') as f: f.truncate(25*1024*1024+1)
                else: p.symlink_to('/etc/hostname')
                with self.assertRaises(ValueError):stage(root,root/'out')
                self.assertFalse((root/'out').exists())

    def test_stage_allows_symlink_above_checkout_but_rejects_links_inside(self):
        with tempfile.TemporaryDirectory() as td:
            base=pathlib.Path(td); real=base/'real';real.mkdir(); alias=base/'alias';alias.symlink_to(real,target_is_directory=True)
            root=alias/'checkout';shots=root/'loopback-evidence';shots.mkdir(parents=True);(shots/'crash.txt').write_text('synthetic')
            self.assertEqual(1,len(stage(root,base/'allowed')))
            linked_root=base/'linked-checkout';linked_root.symlink_to(root,target_is_directory=True)
            with self.assertRaises(ValueError):stage(linked_root,base/'root-rejected')
            (shots/'crash.txt').unlink();shots.rmdir();outside=base/'outside';outside.mkdir();(outside/'crash.txt').write_text('synthetic')
            shots.symlink_to(outside,target_is_directory=True)
            with self.assertRaises(ValueError):stage(root,base/'inner-rejected')
            self.assertFalse((base/'inner-rejected').exists())

if __name__=='__main__':unittest.main()
