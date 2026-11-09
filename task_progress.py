"""Task estimates and per-host progress without running or rendering user tasks."""
from pathlib import Path
import yaml


def estimate_tasks(project, selected, requested_tags):
    project = Path(project)
    requested = set(requested_tags)

    def tags(value):
        if isinstance(value, str):
            return {value}
        return set(value or [])

    def eligible(inherited):
        if 'never' in inherited and not (requested & (inherited - {'never'})):
            return False
        return 'always' in inherited or bool(requested & inherited) or 'all' in requested

    def count_tasks(tasks, inherited, directory, stack):
        count = 0
        for task in tasks or []:
            inherited_tags = inherited | tags(task.get('tags'))
            if 'block' in task:
                count += count_tasks(task['block'], inherited_tags, directory, stack)
                count += count_tasks(task.get('always'), inherited_tags, directory, stack)
                # Rescue tasks only become applicable after a failure.
                continue
            imported = task.get('ansible.builtin.import_tasks', task.get('import_tasks'))
            if imported:
                if isinstance(imported, dict):
                    imported = imported.get('file', '')
                if not isinstance(imported, str) or '{{' in imported:
                    count += int(eligible(inherited_tags))
                    continue
                path = (directory / imported).resolve()
                if path in stack:
                    raise ValueError('Importación circular de tareas.')
                content = yaml.safe_load(path.read_text(encoding='utf-8'))
                count += count_tasks(content, inherited_tags, path.parent, stack | {path})
            elif eligible(inherited_tags):
                count += 1
        return count

    total = 0
    for name in selected:
        path = project / (name + '.yml')
        for play in yaml.safe_load(path.read_text(encoding='utf-8')):
            inherited = tags(play.get('tags'))
            # Ansible's implicit setup inherits play tags instead of always.
            if play.get('gather_facts', True) and eligible(inherited or {'always'}):
                total += 1
            for section in ('pre_tasks', 'tasks', 'post_tasks'):
                total += count_tasks(play.get(section), inherited, project, {path.resolve()})
    return total


class HostProgress:
    terminal_events = {'runner_on_ok', 'runner_on_failed', 'runner_on_unreachable',
                       'runner_on_skipped', 'runner_on_async_failed'}

    def __init__(self, hosts):
        self.public = {ip: {'completed': 0, 'executed': 0, 'skipped': 0,
                            'total': None, 'estimated': True, 'current_task': '',
                            'failed': False} for ip in hosts}
        self.finished = {ip: set() for ip in hosts}
        self.started = {ip: set() for ip in hosts}

    def set_estimate(self, total):
        for progress in self.public.values():
            progress['total'] = total

    def update(self, ip, kind, data, task_name):
        if ip not in self.public:
            return
        progress = self.public[ip]
        task_id = data.get('task_uuid')
        # Old Runner events without UUID still contribute one result each.
        if not task_id:
            task_id = ('unnamed', progress['completed'])
        if kind == 'runner_on_start':
            self.started[ip].add(task_id)
            progress['current_task'] = task_name
        elif kind in self.terminal_events:
            if task_id not in self.finished[ip]:
                self.finished[ip].add(task_id)
                self.started[ip].add(task_id)
                progress['completed'] += 1
                progress['skipped' if kind == 'runner_on_skipped' else 'executed'] += 1
            progress['current_task'] = ''
            if kind in {'runner_on_failed', 'runner_on_unreachable', 'runner_on_async_failed'} and not data.get('ignore_errors'):
                progress['failed'] = True
        if progress['total'] is not None:
            progress['total'] = max(progress['total'], len(self.started[ip]), progress['completed'])

    def finish(self, successful):
        for progress in self.public.values():
            progress['current_task'] = ''
            if successful:
                progress['total'] = progress['completed']
                progress['estimated'] = False
