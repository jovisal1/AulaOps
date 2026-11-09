import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import yaml
from test_app import aula


class BundledRecipeTests(unittest.TestCase):
    def recipes(self):
        return [json.loads(path.read_text()) for path in (aula.ROOT / 'recipes').glob('custom_*.json')]

    def test_all_four_recipes_are_available_and_have_valid_syntax(self):
        recipes = self.recipes()
        self.assertEqual(len(recipes), 4)
        self.assertTrue({r['id'] for r in recipes}.issubset({r['id'] for r in aula.available_recipes()}))
        executable = str(pathlib.Path(aula.sys.executable).parent / 'ansible-playbook')
        with tempfile.TemporaryDirectory() as folder:
            project = pathlib.Path(folder) / 'project'
            shutil.copytree(aula.ROOT / 'playbooks', project)
            for recipe in recipes:
                with self.subTest(recipe=recipe['name']):
                    path = project / 'recipe.yml'
                    path.write_text(yaml.safe_dump([aula.recipe_play(recipe)], sort_keys=False))
                    result = subprocess.run([executable, '-i', 'aula,', str(path), '--syntax-check'],
                                            capture_output=True, text=True, timeout=30)
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_xampp_requires_account_and_shutdown_is_last(self):
        recipes = self.recipes()
        xampp = next(r['id'] for r in recipes if r.get('requires_account'))
        shutdown = next(r['id'] for r in recipes if r.get('shutdown'))
        base = {'hosts': ['192.168.1.2'], 'ssh_user': 'usuario'}
        with self.assertRaises(ValueError):
            aula.validate_run(base | {'recipes': [xampp]})
        aula.validate_run(base | {'recipes': [xampp], 'target_user': 'examenPRG'})
        with self.assertRaisesRegex(ValueError, 'Coloca Crear usuario'):
            aula.validate_run(base | {'recipes': [xampp, 'user'], 'target_user': 'examenPRG', 'target_password': 'test-only'})
        with self.assertRaisesRegex(ValueError, 'Apagar PCs'):
            aula.validate_run(base | {'recipes': [shutdown, 'java']})
        aula.validate_run(base | {'recipes': ['java', shutdown]})
