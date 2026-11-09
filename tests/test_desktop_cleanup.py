from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import yaml

ROOT = Path(__file__).parents[1]


class DesktopCleanupTests(unittest.TestCase):
    def run_cleanup(self, directory, home, desktop, after_tasks=None, check=False):
        play = [{'hosts': 'all', 'gather_facts': False,
                 'vars': {'aula_home': str(home), 'aula_desktop': str(desktop),
                          'ansible_python_interpreter': sys.executable,
                          'ansible_remote_tmp': str(directory / 'remote')},
                 'tasks': [{'ansible.builtin.import_tasks': str(ROOT / 'playbooks/tasks/clear_desktop_folders.yml')}]
                          + (after_tasks or [])}]
        path = directory / 'cleanup-test.yml'
        path.write_text(yaml.safe_dump(play))
        command = [str(Path(sys.executable).parent / 'ansible-playbook'), '-i', 'localhost,', '-c', 'local', str(path)]
        if check:
            command.append('--check')
        return subprocess.run(command, capture_output=True, text=True, timeout=30)

    def test_old_folders_are_removed_before_new_destination_is_created(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            home = directory / 'home'
            desktop = home / 'Escritorio'
            for name in ['Materiales', 'Otra carpeta', '.oculta']:
                (desktop / name / 'subcarpeta').mkdir(parents=True)
                (desktop / name / 'subcarpeta/antiguo.txt').write_text('viejo')
            (desktop / 'conservar.txt').write_text('archivo suelto')
            external = directory / 'externo'
            external.mkdir()
            (external / 'intacto.txt').write_text('no tocar')
            (desktop / 'enlace').symlink_to(external, target_is_directory=True)
            result = self.run_cleanup(directory, home, desktop, [
                {'ansible.builtin.file': {'path': str(desktop / 'Materiales'), 'state': 'directory'}},
                {'ansible.builtin.copy': {'content': 'nuevo', 'dest': str(desktop / 'Materiales/nuevo.txt')}},
            ])
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(sorted(p.name for p in desktop.iterdir()), ['Materiales', 'conservar.txt', 'enlace'])
            self.assertEqual(sorted(p.name for p in (desktop / 'Materiales').iterdir()), ['nuevo.txt'])
            self.assertEqual((desktop / 'conservar.txt').read_text(), 'archivo suelto')
            self.assertEqual((external / 'intacto.txt').read_text(), 'no tocar')

    def test_home_or_symlink_outside_home_is_rejected_before_deleting(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            home = directory / 'home'
            (home / 'protegida').mkdir(parents=True)
            external = directory / 'externo'
            (external / 'protegida').mkdir(parents=True)
            desktop = home / 'Escritorio'
            desktop.symlink_to(external, target_is_directory=True)
            for destination in [home, desktop]:
                with self.subTest(destination=destination):
                    result = self.run_cleanup(directory, home, destination)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn('No se han borrado carpetas', result.stdout)
                    self.assertTrue((home / 'protegida').is_dir())
                    self.assertTrue((external / 'protegida').is_dir())

    def test_check_mode_keeps_all_contents(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            home = directory / 'home'
            desktop = home / 'Escritorio'
            (desktop / 'vieja').mkdir(parents=True)
            (desktop / 'vieja/archivo.txt').write_text('conservar en simulación')
            result = self.run_cleanup(directory, home, desktop, check=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((desktop / 'vieja/archivo.txt').exists())
