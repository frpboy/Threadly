import unittest,tempfile,pathlib,json,os,contextlib,io
from unittest.mock import patch
import run_native
import test_native_receipt

class RunNativeTest(unittest.TestCase):
    def run_case(self,wrong_uid=False,fail_v6=False,bad_status=False):
        calls=[]
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);state=root/'private.json';state.write_text(json.dumps({'invite':'T'*43}));state.chmod(0o600)
            def child(argv,**kwargs):
                calls.append(argv)
                class Result:returncode=0;stdout=''
                r=Result()
                if 'packages' in argv:r.stdout='package:com.frpboy.threadly.qa uid:'+('10151' if wrong_uid else '10150')+'\n'
                elif 'ip6tables' in argv and fail_v6:r.returncode=1
                elif 'instrumentation' in argv:r.stdout='instrumentation:com.frpboy.threadly.qa.test/androidx.test.runner.AndroidJUnitRunner (target=com.frpboy.threadly.qa)\n'
                elif 'instrument' in argv:
                    r.stdout=test_native_receipt.NativeReceiptTest().sample((1,-2) if bad_status else (1,0)).replace('class=C','class=app.threadly.game.BetaEnrollmentTest').replace('test=T','test=enrollsActualActivityPlaysAndResumesOnOwnedSyntheticServer')
                return r
            error=None
            with patch.object(run_native.sys,'argv',['run_native',str(state),'enrollment']),patch.dict(os.environ,{'THREADLY_QA_UID':'10150'}),patch.object(pathlib.Path,'cwd',return_value=root),patch.object(run_native.subprocess,'run',side_effect=child),contextlib.redirect_stdout(io.StringIO()):
                try:run_native.main()
                except ValueError as e:error=e
            return calls,error,(root/'beta-evidence/enrollment.xml').exists()
    def test_same_uid_both_fences_exact_receipt(self):
        calls,error,exists=self.run_case();self.assertIsNone(error);self.assertTrue(exists)
        self.assertEqual(sum('iptables' in c for c in calls),3);self.assertEqual(sum('ip6tables' in c for c in calls),3)
        self.assertEqual(sum('instrument' in c for c in calls),1);self.assertFalse(any('install' in c or 'uninstall' in c for c in calls))
    def test_changed_uid_never_runs_native(self):
        calls,error,exists=self.run_case(wrong_uid=True);self.assertIsNotNone(error);self.assertFalse(exists);self.assertFalse(any('instrument' in c for c in calls))
    def test_missing_v6_rule_never_runs_native(self):
        calls,error,exists=self.run_case(fail_v6=True);self.assertIsNotNone(error);self.assertFalse(exists);self.assertFalse(any('instrument' in c for c in calls))
    def test_failure_never_writes_receipt(self):
        calls,error,exists=self.run_case(bad_status=True);self.assertIsNotNone(error);self.assertFalse(exists)
if __name__=='__main__':unittest.main()
