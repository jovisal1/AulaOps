import os
from pathlib import Path
import sys
import tempfile
import unittest
import yaml
from task_progress import HostProgress, estimate_tasks


class TaskProgressTests(unittest.TestCase):
    def test_per_host_deduplication_skips_and_failed_host(self):
        progress = HostProgress(['192.168.1.2', '192.168.1.3'])
        progress.set_estimate(8)
        ip = '192.168.1.2'
        progress.update(ip, 'runner_on_start', {'task_uuid': 'one'}, 'Instalar paquete')
        self.assertEqual(progress.public[ip]['current_task'], 'Instalar paquete')
        progress.update(ip, 'runner_on_ok', {'task_uuid': 'one'}, '')
        progress.update(ip, 'runner_on_ok', {'task_uuid': 'one'}, '')
        progress.update(ip, 'runner_on_skipped', {'task_uuid': 'two'}, '')
        self.assertEqual(progress.public[ip]['completed'], 2)
        self.assertEqual(progress.public[ip]['executed'], 1)
        self.assertEqual(progress.public[ip]['skipped'], 1)
        self.assertEqual(progress.public['192.168.1.3']['completed'], 0)
        progress.update('192.168.1.3', 'runner_on_unreachable', {'task_uuid': 'one'}, '')
        progress.finish(False)
        self.assertTrue(progress.public['192.168.1.3']['failed'])
        self.assertEqual(progress.public['192.168.1.3']['total'], 8)
        self.assertEqual(progress.public['192.168.1.3']['completed'], 1)

    def test_dynamic_task_expands_estimate_and_success_finishes_exactly(self):
        progress = HostProgress(['pc'])
        progress.set_estimate(1)
        progress.update('pc', 'runner_on_ok', {'task_uuid': 'one'}, '')
        progress.update('pc', 'runner_on_start', {'task_uuid': 'dynamic'}, 'Tarea dinámica')
        self.assertEqual(progress.public['pc']['total'], 2)
        progress.update('pc', 'runner_on_ok', {'task_uuid': 'dynamic'}, '')
        progress.finish(True)
        self.assertEqual(progress.public['pc']['total'], 2)
        self.assertFalse(progress.public['pc']['estimated'])
        self.assertEqual(progress.public['pc']['current_task'], '')

    def test_estimate_matches_real_ansible_with_imports_tags_skips_and_loop(self):
        import ansible_runner
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory) / 'project'
            project.mkdir()
            (project / 'shared.yml').write_text(yaml.safe_dump([
                {'name': 'Comprobación compartida', 'ansible.builtin.debug': {'msg': 'ok'}},
                {'name': 'Tarea omitida', 'ansible.builtin.debug': {'msg': 'omitida'}, 'when': False},
            ]))
            variables = {'ansible_connection': 'local', 'ansible_python_interpreter': sys.executable,
                         'ansible_remote_tmp': directory + '/remote'}
            check = [{'name': 'Check', 'hosts': 'all', 'gather_facts': True, 'tags': ['check'],
                      'vars': variables,
                      'pre_tasks': [{'ansible.builtin.import_tasks': 'shared.yml', 'tags': ['always']}],
                      'tasks': [{'ansible.builtin.debug': {'msg': 'not selected'}}]}]
            work = [{'name': 'Work', 'hosts': 'all', 'gather_facts': True, 'tags': ['work'],
                     'vars': variables,
                     'tasks': [{'block': [
                         {'name': 'Bucle', 'ansible.builtin.debug': {'msg': '{{ item }}'}, 'loop': [1, 2, 3]},
                         {'name': 'Otra tarea', 'ansible.builtin.debug': {'msg': 'ok'}},
                     ], 'always': [{'name': 'Siempre', 'ansible.builtin.debug': {'msg': 'ok'}}]}]}]
            for name, content in [('check', check), ('work', work)]:
                (project / (name + '.yml')).write_text(yaml.safe_dump(content))
            (project / 'site.yml').write_text(yaml.safe_dump([
                {'ansible.builtin.import_playbook': 'check.yml'},
                {'ansible.builtin.import_playbook': 'work.yml'}]))
            total = estimate_tasks(project, ['check', 'work'], ['always', 'work'])
            self.assertEqual(total, 6)
            progress = HostProgress(['localhost'])
            progress.set_estimate(total)
            def callback(event):
                data = event.get('event_data', {})
                progress.update(data.get('host'), event.get('event'), data, data.get('task', ''))
                return False
            result = ansible_runner.run(private_data_dir=directory, project_dir=str(project),
                                        playbook='site.yml', inventory={'all': {'hosts': {'localhost': {}}}}, tags='always,work',
                                        quiet=True, event_handler=callback,
                                        envvars={'PATH': str(Path(sys.executable).parent) + os.pathsep + os.environ.get('PATH', ''),
                                                 'ANSIBLE_LOCAL_TEMP': directory + '/local'})
            self.assertEqual(result.rc, 0)
            self.assertEqual(progress.public['localhost']['completed'], total)
            self.assertEqual(progress.public['localhost']['skipped'], 1)
