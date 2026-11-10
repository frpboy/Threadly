import unittest
from native_receipt import receipt

class NativeReceiptTest(unittest.TestCase):
    def sample(self,codes=(1,0)):
        return ''.join('INSTRUMENTATION_STATUS: class=C\nINSTRUMENTATION_STATUS: test=T\nINSTRUMENTATION_STATUS: numtests=1\nINSTRUMENTATION_STATUS: current=1\nINSTRUMENTATION_STATUS_CODE: '+str(c)+'\n' for c in codes)+'INSTRUMENTATION_RESULT: stream=\nOK (1 test)\nINSTRUMENTATION_CODE: -1\n'
    def test_exact_single_pass(self):self.assertEqual(receipt(self.sample(),'C','T'),{'classname':'C','name':'T'})
    def test_failure_skip_and_absent_result_rejected(self):
        for text in [self.sample((1,-2)),self.sample((1,-3)),self.sample().replace('INSTRUMENTATION_CODE: -1',''),self.sample().replace('OK (1 test)','')]:
            with self.assertRaises(ValueError):receipt(text,'C','T')
    def test_wrong_duplicate_and_multitest_rejected(self):
        for text in [self.sample().replace('class=C','class=D'),self.sample().replace('numtests=1','numtests=2'),self.sample()+self.sample(),self.sample().replace('test=T','test=T\nINSTRUMENTATION_STATUS: test=T')]:
            with self.assertRaises(ValueError):receipt(text,'C','T')
if __name__=='__main__':unittest.main()
