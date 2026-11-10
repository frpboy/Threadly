import unittest
from installed_uid import installed_uid

class InstalledUidTest(unittest.TestCase):
    def test_exact_target_not_substring_test_uid(self):
        for text in ['package:com.frpboy.threadly.qa.test uid:10151\npackage:com.frpboy.threadly.qa uid:10150\n','package:com.frpboy.threadly.qa uid:10150\npackage:com.frpboy.threadly.qa.test uid:10151\n']:
            self.assertEqual(installed_uid(text),10150)
    def test_missing_wrong_duplicate_shared_and_unsafe_rejected(self):
        good='package:com.frpboy.threadly.qa uid:10150\npackage:com.frpboy.threadly.qa.test uid:10151\n'
        for text in ['',good.splitlines()[0],good.splitlines()[1],good+good,good.replace('qa.test','qa.test2'),good.replace('10151','10150'),good.replace('10150','0'),good.replace('10151','20000'),good+'package:unrelated uid:10152\n']:
            with self.assertRaises(ValueError):installed_uid(text)
if __name__=='__main__':unittest.main()
