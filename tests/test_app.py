import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('aula', pathlib.Path(__file__).parents[1] / 'app.py')
aula = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aula)

class ValidationTests(unittest.TestCase):
    def test_hosts_are_private_unique_sorted(self):
        self.assertEqual(aula.valid_hosts(['192.168.1.10', '192.168.1.2', '192.168.1.10']), ['192.168.1.2', '192.168.1.10'])
        for address in ['8.8.8.8', '127.0.0.1', '::1', '169.254.1.1', '0.0.0.0', '224.0.0.1']:
            with self.assertRaises(ValueError):
                aula.valid_hosts([address])

    def test_run_rejects_injected_or_dangerous_values(self):
        base = {'hosts': ['192.168.1.2'], 'recipes': ['check'], 'ssh_user': 'profesor'}
        aula.validate_run(base)
        for update in [{'ssh_user': 'user;id'}, {'recipes': ['shell']}, {'jdk': '21;id'},
                       {'extensions': ['--force']}, {'settings': []}, {'target_user': 'root'},
                       {'recipes': ['user'], 'target_user': 'alumno'},
                       {'recipes': ['folders'], 'target_user': 'alumno', 'folders': []}]:
            with self.assertRaises((ValueError, TypeError)):
                aula.validate_run(base | update)

    def test_inventory_backups_and_no_credentials(self):
        with tempfile.TemporaryDirectory() as path, patch.object(aula, 'DATA', pathlib.Path(path)):
            aula.save_inventory(['192.168.1.2'], 2222)
            aula.save_inventory(['192.168.2.3'], 22)
            self.assertEqual(len(list(pathlib.Path(path).glob('hosts_*.yml'))), 1)
            content = (pathlib.Path(path) / 'hosts.yml').read_text()
            self.assertIn('192.168.2.3', content)
            self.assertNotIn('password', content)
            self.assertNotIn('192.168.1.2', content)

    def test_discovery_rejects_large_or_public_ranges(self):
        for cidr in ['10.0.0.0/8', '8.8.8.0/24', '::/0']:
            with self.assertRaises(ValueError):
                aula.discover(cidr, 22)

class RunnerTests(unittest.TestCase):
    def test_credentials_are_temporary_and_events_redacted(self):
        import types
        import ansible_runner
        captured = {}
        class ImmediateThread:
            def __init__(self, target, **kwargs):
                self.target = target
            def start(self):
                self.target()
        def fake_run(**kwargs):
            captured.update(kwargs)
            self.assertTrue(pathlib.Path(kwargs['private_data_dir']).is_dir())
            self.assertEqual(pathlib.Path(kwargs['private_data_dir']).stat().st_mode & 0o777, 0o700)
            kwargs['event_handler']({'event': 'runner_on_failed', 'event_data': {
                'host': 'pc_192_168_1_2', 'task': 'Crear usuario',
                'res': {'msg': 'Fallo al conectar: ssh-test-only', 'stdout': 'sudo-test-only'}}})
            return types.SimpleNamespace(rc=2)
        body = {'hosts': ['192.168.1.2'], 'recipes': ['user'], 'ssh_user': 'profesor',
                'target_user': 'alumno', 'target_password': 'example-test-only',
                'ssh_password': 'ssh-test-only', 'sudo_password': 'sudo-test-only'}
        with patch.object(aula.threading, 'Thread', ImmediateThread), patch.object(ansible_runner, 'run', fake_run):
            result = aula.start_run(body)
        self.assertEqual(body, {})
        self.assertFalse(pathlib.Path(captured['private_data_dir']).exists())
        self.assertTrue(captured['extravars']['aula_password_hash'].startswith('$6$'))
        job = aula.JOBS[result['id']]
        self.assertEqual(job['status'], 'failed')
        self.assertNotIn('ssh-test-only', str(job))
        self.assertNotIn('sudo-test-only', str(job))
        self.assertIn('Fallo al conectar', str(job))
        self.assertEqual(job['events'][0]['ip'], '192.168.1.2')
        self.assertNotIn('password', str(job))

if __name__ == '__main__':
    unittest.main()
