import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import yaml
from test_app import aula


class CustomRecipeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = patch.object(aula, 'DATA', Path(self.temp.name))
        self.directory.start()
        aula.JOBS.clear()

    def tearDown(self):
        self.directory.stop()
        self.temp.cleanup()

    def create(self, **updates):
        return aula.add_recipe({'name': 'Comprobar variable', 'description': 'Prueba sin cambios',
                                'content': '- name: Mostrar usuario\n  ansible.builtin.debug:\n    msg: "{{ aula_user }}"\n'} | updates)

    def test_save_validate_reload_and_duplicate(self):
        recipe = self.create()
        loaded = aula.custom_recipes()
        self.assertEqual(loaded[0]['name'], recipe['name'])
        self.assertEqual(loaded[0]['content'], recipe['content'])
        aula.validate_run({'hosts': ['192.168.1.2'], 'recipes': [recipe['id']], 'ssh_user': 'profesor'})
        with self.assertRaisesRegex(ValueError, 'Ya existe'):
            self.create()

    def test_invalid_yaml_playbook_and_module_rejected(self):
        for content in ['bad: [', '{}', '[]', '- hosts: all\n  tasks: []',
                        '- name: Incorrecta\n  ansible.builtin.module_that_does_not_exist: {}']:
            with self.subTest(content=content), self.assertRaises(ValueError):
                self.create(content=content)
        self.assertEqual(aula.custom_recipes(), [])

    def test_selected_recipe_is_in_runner_snapshot(self):
        import ansible_runner
        recipe = self.create()
        def fake_run(**kwargs):
            plays = yaml.safe_load((Path(kwargs['project_dir']) / 'site.yml').read_text())
            self.assertEqual(len(plays), 2)
            self.assertEqual(plays[1], {'ansible.builtin.import_playbook': recipe['id'] + '.yml'})
            custom_play = yaml.safe_load((Path(kwargs['project_dir']) / (recipe['id'] + '.yml')).read_text())[0]
            self.assertEqual(custom_play['hosts'], 'aula')
            self.assertEqual(custom_play['tasks'][0]['name'], 'Mostrar usuario')
            self.assertIn(recipe['id'], kwargs['tags'])
            self.assertTrue(custom_play['become'])
            self.assertEqual(list(kwargs['inventory']['all']['children']['aula']['hosts']), ['pc_192_168_1_2'])
            return types.SimpleNamespace(rc=0)
        class ImmediateThread:
            def __init__(self, target, **kwargs): self.target = target
            def start(self): self.target()
        with patch.object(aula.threading, 'Thread', ImmediateThread), patch.object(ansible_runner, 'run', fake_run):
            result = aula.start_run({'hosts': ['192.168.1.2'], 'recipes': [recipe['id']],
                                     'ssh_user': 'profesor', 'target_user': 'alumno'})
        self.assertEqual(aula.JOBS[result['id']]['status'], 'successful')
        self.assertEqual(aula.JOBS[result['id']]['recipes'], ['Comprobar variable'])
