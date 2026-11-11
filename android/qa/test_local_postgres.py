import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import local_postgres as gate


class LocalPostgresTest(unittest.TestCase):
    def test_ephemeral_credentials_private_masked_no_argv_or_source_literal(self):
        with tempfile.TemporaryDirectory() as td,patch.dict(os.environ,GITHUB_RUN_ID='123',GITHUB_RUN_ATTEMPT='1',NODE_OPTIONS='',NODE_PATH=''):
            state=Path(td)/'owned.json'; calls=[];out=io.StringIO()
            def fake(args,seconds=20):
                calls.append(args)
                if 'inspect' in args:return gate.container_name()
                return 'container-id'
            with patch.object(gate,'command',side_effect=fake),contextlib.redirect_stdout(out):
                gate.start(state);first=gate.load(state);env=gate.environment(state)
                self.assertEqual(0o600,state.stat().st_mode & 0o777)
                self.assertNotIn(first['password'],' '.join(sum(calls,[])))
                self.assertIn('::add-mask::'+first['password'],out.getvalue())
                self.assertIn('::add-mask::'+first['auth'],out.getvalue())
                self.assertIn(first['password'],env['DATABASE_URL']);self.assertNotIn('GITHUB_ENV',env.get('DATABASE_URL',''))
                self.assertFalse(state.with_suffix('.container-env').exists())
                gate.stop(state);self.assertFalse(state.exists())
                gate.start(state);second=gate.load(state);self.assertNotEqual(first['password'],second['password']);gate.stop(state)

    def test_foreign_container_not_removed_and_ownership_record_preserved(self):
        with tempfile.TemporaryDirectory() as td,patch.dict(os.environ,GITHUB_RUN_ID='123',GITHUB_RUN_ATTEMPT='1'):
            state=Path(td)/'owned.json';calls=[]
            def fake(args,seconds=20):
                calls.append(args)
                return 'foreign' if 'inspect' in args else ''
            with patch.object(gate,'command',side_effect=fake),contextlib.redirect_stdout(io.StringIO()):gate.start(state)
            with patch.object(gate,'command',side_effect=fake),self.assertRaises(ValueError):gate.stop(state)
            self.assertFalse(any('rm' in a for a in calls));self.assertTrue(state.exists())

    def test_unsafe_permissions_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            p=Path(td)/'state';p.write_text('{}');p.chmod(0o644)
            with self.assertRaises(ValueError):gate.load(p)

    def test_docker_error_output_not_propagated(self):
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],9,b'private-url',b'private-url')):
            with self.assertRaisesRegex(RuntimeError,'^owned local container command failed$'):gate.command(['docker','inspect'])


if __name__=='__main__':unittest.main()
