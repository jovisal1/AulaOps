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
        self.assertEqual(saved['variables']['aula_extensions'], ['vscjava.vscode-java-pack', 'redhat.java', 'sohibe.java-generate-setters-getters', 'esbenp.prettier-vscode'])
        self.assertEqual(aula.global_variables()['aula_jdk'], '25')
        aula.save_global_variables('aula_user: otro\n')
        self.assertEqual(len(list(pathlib.Path(self.temp.name).glob('global_vars_*.yml'))), 1)

    def test_exam_username_and_surrounding_whitespace(self):
        for username in ['examen', ' examen ', 'examen\n']:
            self.assertEqual(aula.validate_globals({'aula_user': username})['aula_user'], 'examen')
        self.assertEqual(aula.validate_globals({'aula_user': 'examenPRG'})['aula_user'], 'examenPRG')
        with self.assertRaisesRegex(ValueError, r'variables globales \(aula_user\)'):
            aula.validate_globals({'aula_user': 'nombre inválido'})
        aula.validate_run({'hosts': ['192.168.1.2'], 'recipes': ['user'],
                           'ssh_user': 'usuario', 'target_user': 'examenPRG',
                           'target_password': 'test-only'})

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

    def test_preflight_collects_facts_when_play_tag_is_not_selected(self):
        executable = str(pathlib.Path(aula.sys.executable).parent / 'ansible-playbook')
        preflight = yaml.safe_load((aula.ROOT / 'playbooks/tasks/preflight.yml').read_text())
        play = [{'name': 'Preflight con filtro de recetas', 'hosts': 'all',
                 'gather_facts': True, 'tags': ['check'],
                 'tasks': preflight[:2]}]
        with tempfile.TemporaryDirectory() as directory:
            play[0]['vars'] = {'ansible_remote_tmp': directory + '/remote',
                               'ansible_python_interpreter': aula.sys.executable}
            path = pathlib.Path(directory) / 'preflight.yml'
            path.write_text(yaml.safe_dump(play))
            result = subprocess.run([executable, '-i', 'localhost,', '-c', 'local',
                                     str(path), '--tags', 'always,java'],
                                    capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Recopilar datos del sistema', result.stdout)

    def test_missing_target_account_has_actionable_error(self):
        executable = str(pathlib.Path(aula.sys.executable).parent / 'ansible-playbook')
        tasks = yaml.safe_load((aula.ROOT / 'playbooks/tasks/account.yml').read_text())
        with tempfile.TemporaryDirectory() as directory:
            play = [{'hosts': 'all', 'gather_facts': False,
                     'vars': {'aula_user': 'aulaops_missing_test_7291',
                              'ansible_remote_tmp': directory + '/remote',
                              'ansible_python_interpreter': aula.sys.executable},
                     'tasks': tasks}]
            path = pathlib.Path(directory) / 'account.yml'
            path.write_text(yaml.safe_dump(play))
            result = subprocess.run([executable, '-i', 'localhost,', '-c', 'local', str(path)],
                                    capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn('aulaops_missing_test_7291', result.stdout)
        self.assertIn('Crear usuario del aula', result.stdout)
        self.assertNotIn('One or more supplied key', result.stdout)
