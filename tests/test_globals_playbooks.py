import pathlib
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch
import yaml
from test_app import aula


class GlobalVariableTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = patch.object(aula, 'DATA', pathlib.Path(self.temp.name))
        self.data.start()
        aula.JOBS.clear()

    def tearDown(self):
        self.data.stop()
        self.temp.cleanup()

    def test_defaults_override_persistence_and_backup(self):
        self.assertEqual(aula.global_variables()['aula_user'], 'alumno')
        saved = aula.save_global_variables("aula_user: estudiante\naula_jdk: '25'\ncurso: PMDM\n")
        self.assertEqual(saved['variables']['curso'], 'PMDM')
        self.assertEqual(saved['variables']['aula_extensions'], ['vscjava.vscode-java-pack'])
        self.assertEqual(aula.global_variables()['aula_jdk'], '25')
        aula.save_global_variables('aula_user: otro\n')
        self.assertEqual(len(list(pathlib.Path(self.temp.name).glob('global_vars_*.yml'))), 1)

    def test_bad_yaml_types_and_runtime_credentials_are_rejected(self):
        for content in ['bad: [', '[]', 'null', 'aula_user: root', 'ansible_user: root',
                        'aula_password_hash: secret', 'aula_settings: []', 'aula_extensions: git',
                        'aula_reset_password: "yes"', 'aula_jdk: "21;id"', 'day: 2026-11-08']:
            with self.subTest(content=content), self.assertRaises(ValueError):
                aula.save_global_variables(content)
        self.assertFalse((pathlib.Path(self.temp.name) / 'global_vars.yml').exists())

    def test_selected_playbooks_and_globals_are_snapshotted_with_run_overrides(self):
        import ansible_runner
        aula.save_global_variables("aula_user: estudiante\naula_jdk: '25'\ncurso: PMDM\n")
        captured = {}
        class ImmediateThread:
            def __init__(self, target, **kwargs): self.target = target
            def start(self): self.target()
        def fake_run(**kwargs):
            captured.update(kwargs)
            project = pathlib.Path(kwargs['project_dir'])
            plays = yaml.safe_load((project / 'site.yml').read_text())
            self.assertEqual(plays, [{'ansible.builtin.import_playbook': 'check.yml'}, {'ansible.builtin.import_playbook': 'java.yml'}])
            self.assertEqual(yaml.safe_load((project / 'vars/global.yml').read_text())['aula_jdk'], '25')
            self.assertEqual(kwargs['extravars']['aula_jdk'], '17')
            self.assertEqual(kwargs['extravars']['curso'], 'PMDM')
            self.assertEqual(kwargs['extravars']['aula_user'], 'estudiante')
            return types.SimpleNamespace(rc=0)
        with patch.object(aula.threading, 'Thread', ImmediateThread), patch.object(ansible_runner, 'run', fake_run):
            result = aula.start_run({'hosts': ['192.168.1.2'], 'recipes': ['java'], 'ssh_user': 'profesor', 'jdk': '17'})
        self.assertEqual(aula.JOBS[result['id']]['status'], 'successful')

    def test_individual_playbooks_have_valid_syntax(self):
        executable = str(pathlib.Path(aula.sys.executable).parent / 'ansible-playbook')
        for recipe in ['check', 'user', 'java', 'vscode', 'folders', 'delete_user', 'site']:
            with self.subTest(recipe=recipe):
                result = subprocess.run([executable, '-i', 'aula,', str(aula.ROOT / 'playbooks' / (recipe + '.yml')), '--syntax-check'], capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stderr)
