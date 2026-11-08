import importlib.util
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
from test_app import aula

spec = importlib.util.spec_from_file_location('bootstrap', Path(__file__).parents[1] / 'iniciar.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class DeleteTests(unittest.TestCase):
    def test_delete_requires_exact_confirmation_and_protects_accounts(self):
        base = {'hosts': ['192.168.1.2'], 'recipes': ['delete_user'], 'ssh_user': 'profesor',
                'delete_username': 'alumno', 'delete_confirmation': 'alumno'}
        aula.validate_run(base)
        for update in [{'delete_confirmation': ''}, {'delete_confirmation': 'otro'},
                       {'delete_username': 'root', 'delete_confirmation': 'root'},
                       {'delete_username': 'profesor', 'delete_confirmation': 'profesor'},
                       {'delete_username': 'nobody', 'delete_confirmation': 'nobody'},
                       {'recipes': ['delete_user', 'java']}, {'delete_home': 'true'},
                       {'delete_username': 'user;id'}]:
            with self.subTest(update=update), self.assertRaises(ValueError):
                aula.validate_run(base | update)

    def test_no_log_nested_and_credentials_redacted(self):
        result = {'msg': 'Error SSH password=secret123', 'stdout': 'sudo-value', 'rc': 2,
                  'results': [{'_ansible_no_log': True, 'stdout': 'hidden-content'},
                              {'stderr': 'APT no pudo encontrar el paquete', 'rc': 100}]}
        detail = aula.result_details(result, ['secret123', 'sudo-value'])
        self.assertNotIn('secret123', str(detail))
        self.assertNotIn('sudo-value', str(detail))
        self.assertNotIn('hidden-content', str(detail))
        self.assertIn('APT no pudo encontrar', str(detail))
        self.assertEqual(detail['rc'], 2)

    def test_output_is_bounded(self):
        detail = aula.result_details({'stdout': 'x' * 100000})
        self.assertLess(len(detail['stdout']), 16100)
        self.assertIn('recortada', detail['stdout'])


class InstallerTests(unittest.TestCase):
    def test_sudo_password_stays_off_arguments_and_logs(self):
        bootstrap.STATE.update(log=[])
        completed = types.SimpleNamespace(returncode=0, stdout='Contraseña: test-sudo-secret')
        with patch.object(bootstrap.subprocess, 'run', return_value=completed) as run:
            bootstrap.run_command(['apt-get', 'update'], 'test-sudo-secret', True)
        args, kwargs = run.call_args
        self.assertNotIn('test-sudo-secret', str(args))
        self.assertEqual(kwargs['input'], 'test-sudo-secret\n')
        self.assertNotIn('test-sudo-secret', str(bootstrap.STATE['log']))

    def test_install_steps_and_stamp_without_system_changes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'requirements.txt').write_text('ansible-runner\n')
            venv = root / '.venv'
            venv.mkdir()
            with patch.object(bootstrap, 'ROOT', root), patch.object(bootstrap, 'VENV', venv), \
                 patch.object(bootstrap.os, 'geteuid', return_value=1000), \
                 patch.object(bootstrap.shutil, 'which', return_value='/usr/bin/tool'), \
                 patch.object(bootstrap, 'dependency_status', return_value={'ready': True}), \
                 patch.object(bootstrap, 'run_command') as command:
                bootstrap.install('test-only')
                self.assertEqual(command.call_count, 4)
                self.assertEqual(bootstrap.STATE['status'], 'successful')
                self.assertTrue((venv / '.aula-requirements-sha256').exists())
                self.assertNotIn('test-only', str(bootstrap.STATE))

    def test_install_failure_is_visible(self):
        with patch.object(bootstrap.os, 'geteuid', return_value=1000), \
             patch.object(bootstrap.shutil, 'which', return_value='/usr/bin/tool'), \
             patch.object(bootstrap, 'run_command', side_effect=RuntimeError('Falló APT')):
            bootstrap.install('')
        self.assertEqual(bootstrap.STATE['status'], 'failed')
        self.assertEqual(bootstrap.STATE['error'], 'Falló APT')
