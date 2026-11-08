#!/usr/bin/env python3
"""Control local de aulas. Escucha exclusivamente en loopback."""
import concurrent.futures
import datetime
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import socket
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import yaml

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data'
DATA.mkdir(mode=0o700, exist_ok=True)
os.umask(0o077)
TOKEN = secrets.token_urlsafe(32)
JOBS = {}
LOCK = threading.RLock()
RECIPES = {'check', 'user', 'java', 'vscode', 'folders', 'delete_user'}


GLOBAL_FIELDS = {'aula_user': 'target_user', 'aula_jdk': 'jdk',
                 'aula_extensions': 'extensions', 'aula_settings': 'settings',
                 'aula_folders': 'folders', 'aula_reset_password': 'reset_password',
                 'aula_delete_home': 'delete_home'}


def validate_globals(values):
    if not isinstance(values, dict) or len(values) > 200:
        raise ValueError('Las variables globales deben ser un mapa YAML de hasta 200 variables.')
    reserved = {'hostvars', 'groups', 'inventory_hostname', 'inventory_dir', 'inventory_file',
                'playbook_dir', 'environment', 'aula_password_hash', 'aula_home', 'aula_gid',
                'aula_desktop', 'ssh_password', 'sudo_password', 'target_password'}
    for key in values:
        if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key) or key.startswith(('ansible_', '__')) or key in reserved:
            raise ValueError('Nombre de variable global no permitido: ' + str(key))
    try:
        encoded = json.dumps(values, allow_nan=False)
    except (TypeError, ValueError, RecursionError):
        raise ValueError('Usa valores YAML simples: textos, números, booleanos, listas y mapas.') from None
    if len(encoded.encode()) > 65536:
        raise ValueError('Las variables globales superan 64 KiB.')
    if 'aula_user' in values and (not isinstance(values['aula_user'], str) or not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', values['aula_user']) or values['aula_user'] == 'root'):
        raise ValueError('Usuario del aula inválido.')
    if 'aula_jdk' in values and (not re.fullmatch(r'[0-9]{1,2}', str(values['aula_jdk'])) or not 8 <= int(values['aula_jdk']) <= 99):
        raise ValueError('Versión OpenJDK inválida.')
    for key in ('aula_reset_password', 'aula_delete_home'):
        if key in values and not isinstance(values[key], bool):
            raise ValueError(key + ' debe ser booleano.')
    if 'aula_settings' in values and not isinstance(values['aula_settings'], dict):
        raise ValueError('aula_settings debe ser un mapa.')
    for key in ('aula_extensions', 'aula_folders'):
        if key in values and (not isinstance(values[key], list) or any(not isinstance(item, str) for item in values[key])):
            raise ValueError(key + ' debe ser una lista de textos.')
    if len(values.get('aula_folders', [])) > 30:
        raise ValueError('Lista de carpetas inválida.')
    extensions = values.get('aula_extensions', [])
    if len(extensions) > 100 or any(not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+', item) for item in extensions):
        raise ValueError('Extensiones inválidas: usa editor.extension, una por línea.')
    return values


def global_variables():
    with LOCK:
        defaults = yaml.safe_load((ROOT / 'playbooks/vars/global.yml').read_text(encoding='utf-8'))
        path = DATA / 'global_vars.yml'
        try:
            saved = yaml.safe_load(path.read_text(encoding='utf-8')) if path.exists() else {}
            return validate_globals(defaults | validate_globals(saved))
        except (OSError, yaml.YAMLError):
            raise ValueError('No se pudieron leer las variables globales guardadas.') from None


def global_response():
    values = global_variables()
    return {'variables': values, 'content': yaml.safe_dump(values, sort_keys=False, allow_unicode=True)}


def save_global_variables(content):
    if not isinstance(content, str) or len(content.encode()) > 65536:
        raise ValueError('El YAML global debe ocupar como máximo 64 KiB.')
    try:
        values = validate_globals(yaml.safe_load(content))
    except yaml.YAMLError:
        raise ValueError('YAML inválido. Revisa la indentación y el formato.') from None
    with LOCK:
        defaults = yaml.safe_load((ROOT / 'playbooks/vars/global.yml').read_text(encoding='utf-8'))
        validate_globals(defaults | values)
        path = DATA / 'global_vars.yml'
        if path.exists():
            stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            (DATA / ('global_vars_' + stamp + '.yml')).write_bytes(path.read_bytes())
        temporary = DATA / 'global_vars.tmp'
        temporary.write_text(yaml.safe_dump(values, sort_keys=False, allow_unicode=True), encoding='utf-8')
        temporary.replace(path)
        return global_response()


def recipe_directory():
    path = DATA / 'recipes'
    path.mkdir(mode=0o700, exist_ok=True)
    return path


def custom_recipes():
    with LOCK:
        return [json.loads(p.read_text(encoding='utf-8'))
                for p in sorted(recipe_directory().glob('custom_*.json'))]


def recipe_play(recipe):
    return {'name': recipe['name'], 'hosts': 'aula', 'become': True,
            'gather_facts': True, 'serial': 10, 'tags': [recipe['id']],
            'vars_files': ['vars/global.yml'],
            'pre_tasks': [{'ansible.builtin.import_tasks': 'tasks/preflight.yml', 'tags': ['always']}],
            'tasks': recipe['tasks']}


def add_recipe(body):
    name = body.get('name', '').strip()
    description = body.get('description', '').strip()
    content = body.get('content', '')
    if not name or len(name) > 80 or len(description) > 300:
        raise ValueError('Indica un nombre de hasta 80 caracteres y una descripción de hasta 300.')
    if not isinstance(content, str) or not content.strip() or len(content.encode()) > 65536:
        raise ValueError('El YAML debe tener contenido y ocupar como máximo 64 KiB.')
    try:
        tasks = yaml.safe_load(content)
    except yaml.YAMLError:
        raise ValueError('YAML inválido. Revisa la indentación y el formato.') from None
    if not isinstance(tasks, list) or not tasks or any(not isinstance(t, dict) or not t for t in tasks):
        raise ValueError('Introduce una lista YAML de tareas de Ansible, no un playbook completo.')
    if any('hosts' in task or 'import_playbook' in task for task in tasks):
        raise ValueError('No incluyas hosts ni import_playbook: los equipos se eligen en la interfaz.')
    recipe = {'id': 'custom_' + secrets.token_hex(8), 'name': name,
              'description': description, 'content': content, 'tasks': tasks}
    executable = shutil.which('ansible-playbook') or str(Path(sys.executable).parent / 'ansible-playbook')
    with tempfile.TemporaryDirectory(prefix='aula-validar-') as temp:
        shutil.copytree(ROOT / 'playbooks', Path(temp), dirs_exist_ok=True)
        play = Path(temp) / 'recipe.yml'
        play.write_text(yaml.safe_dump([recipe_play(recipe)], sort_keys=False), encoding='utf-8')
        try:
            checked = subprocess.run([executable, '-i', 'aula,', str(play), '--syntax-check'],
                                     capture_output=True, text=True, timeout=30,
                                     cwd=temp, env={**os.environ, 'ANSIBLE_NOCOLOR': '1',
                                                    'ANSIBLE_LOG_PATH': '/dev/null'})
        except (OSError, subprocess.TimeoutExpired):
            raise ValueError('No se pudo validar. Activa el entorno virtual e instala las dependencias.') from None
        if checked.returncode:
            raise ValueError('Ansible no acepta esta receta: ' + checked.stderr[-1800:])
    with LOCK:
        if any(r['name'].casefold() == name.casefold() for r in custom_recipes()):
            raise ValueError('Ya existe una receta con ese nombre. Usa otro nombre para la nueva versión.')
        path = recipe_directory() / (recipe['id'] + '.json')
        path.write_text(json.dumps(recipe, ensure_ascii=False), encoding='utf-8')
    return {k: v for k, v in recipe.items() if k != 'tasks'}


def valid_hosts(values):
    if not isinstance(values, list) or not values or len(values) > 1024:
        raise ValueError('Selecciona entre 1 y 1024 direcciones IPv4.')
    result = []
    for value in values:
        addr = ipaddress.ip_address(value)
        if addr.version != 4 or not addr.is_private or addr.is_loopback or addr.is_unspecified or addr.is_multicast or addr.is_link_local:
            raise ValueError('Solo se admiten IPv4 privadas de la red del aula.')
        result.append(str(addr))
    return sorted(set(result), key=ipaddress.ip_address)


def inventory(hosts, port):
    return {'all': {'children': {'aula': {'hosts': {
        'pc_' + ip.replace('.', '_'): {'ansible_host': ip, 'ansible_port': port}
        for ip in hosts}}}}}


def save_inventory(hosts, port):
    with LOCK:
        target = DATA / 'hosts.yml'
        if target.exists():
            stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
            (DATA / ('hosts_' + stamp + '.yml')).write_bytes(target.read_bytes())
        tmp = DATA / 'hosts.tmp'
        tmp.write_text(yaml.safe_dump(inventory(hosts, port), sort_keys=False), encoding='utf-8')
        tmp.replace(target)


PRIVATE_NETWORKS = tuple(ipaddress.ip_network(cidr) for cidr in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))


def local_networks():
    """Lee las interfaces y la ruta preferida sin contactar con servicios externos."""
    try:
        addresses = json.loads(subprocess.run(['ip', '-j', '-4', 'address', 'show', 'up'],
                               capture_output=True, text=True, check=True, timeout=5).stdout)
        routes = json.loads(subprocess.run(['ip', '-j', '-4', 'route', 'show', 'default'],
                            capture_output=True, text=True, check=True, timeout=5).stdout)
    except (OSError, subprocess.SubprocessError, ValueError):
        raise ValueError('No se pudieron detectar las redes locales. Comprueba la conexión y que iproute2 esté instalado.') from None
    priorities = {}
    for route in routes:
        device = route.get('dev', '')
        priorities[device] = min(priorities.get(device, float('inf')), route.get('metric', 0))
    networks = []
    for device in addresses:
        interface = device.get('ifname', '')
        flags = device.get('flags', [])
        if ('LOOPBACK' in flags or 'POINTOPOINT' in flags or device.get('operstate') != 'UP'
                or interface.startswith(('docker', 'veth', 'virbr', 'tun', 'tap', 'wg', 'tailscale'))):
            continue
        for address in device.get('addr_info', []):
            if address.get('family') != 'inet' or address.get('scope') != 'global':
                continue
            try:
                local = ipaddress.ip_interface(str(address['local']) + '/' + str(address['prefixlen']))
            except (KeyError, ValueError):
                continue
            if not any(local.network.subnet_of(private) for private in PRIVATE_NETWORKS):
                continue
            networks.append({'id': interface + ':' + str(local), 'interface': interface,
                             'address': str(local.ip), 'cidr': str(local.network)})
    networks.sort(key=lambda item: (priorities.get(item['interface'], float('inf')), item['interface'], item['address']))
    if not networks:
        raise ValueError('No se detectó una red local IPv4 activa. Conecta este equipo por cable o Wi-Fi y vuelve a intentarlo.')
    return networks


def discover_local(network_id, port):
    networks = local_networks()  # Releer antes de explorar: la conexión puede haber cambiado.
    chosen = networks[0] if not network_id else next((item for item in networks if item['id'] == network_id), None)
    if chosen is None:
        raise ValueError('La conexión seleccionada ha cambiado. Actualiza las redes y vuelve a intentarlo.')
    hosts = discover(chosen['cidr'], port, max_addresses=65536,
                     exclude={item['address'] for item in networks})
    return {'hosts': hosts, 'network': chosen}


def discover(cidr, port, max_addresses=1024, exclude=()):
    network = ipaddress.ip_network(cidr, strict=False)
    if network.version != 4 or network.num_addresses > max_addresses:
        raise ValueError('La red supera el límite de exploración: ' + str(max_addresses) + ' direcciones IPv4.')
    if not any(network.subnet_of(private) for private in PRIVATE_NETWORKS):
        raise ValueError('Solo se admiten IPv4 privadas de la red del aula.')
    hosts = [str(ip) for ip in network.hosts() if str(ip) not in exclude]
    def probe(ip):
        try:
            with socket.create_connection((ip, port), timeout=0.7) as connection:
                connection.settimeout(0.7)
                banner = connection.recv(255)
                return ip if banner.startswith(b'SSH-') else None
        except OSError:
            return None
    with concurrent.futures.ThreadPoolExecutor(max_workers=48) as pool:
        return [ip for ip in pool.map(probe, hosts) if ip]


def port_value(value):
    port = int(value)
    if not 1 <= port <= 65535:
        raise ValueError('Puerto SSH inválido.')
    return port


def validate_run(body):
    hosts = valid_hosts(body.get('hosts'))
    recipes = body.get('recipes', [])
    if not isinstance(recipes, list) or not recipes or any(not isinstance(r, str) or r not in RECIPES | {c['id'] for c in custom_recipes()} for r in recipes):
        raise ValueError('Elige al menos una receta válida.')
    for field in ('ssh_user', 'target_user'):
        value = body.get(field, '')
        if (field == 'ssh_user' or any(r in recipes for r in ('user', 'vscode', 'folders'))) and not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', value):
            raise ValueError('Usuario inválido: ' + field)
    if body.get('target_user') == 'root':
        raise ValueError('El usuario de aula no puede ser root.')
    if 'user' in recipes and not body.get('target_password'):
        raise ValueError('Introduce la contraseña del usuario que vas a crear.')
    if 'delete_user' in recipes:
        username = body.get('delete_username', '')
        if not isinstance(username, str) or not re.fullmatch(r'[a-z_][a-z0-9_-]{0,31}', username):
            raise ValueError('Indica un nombre de usuario válido para eliminar.')
        if username in {'root', 'nobody', body.get('ssh_user')}:
            raise ValueError('No se puede eliminar root, nobody ni el usuario de conexión SSH.')
        if body.get('delete_confirmation') != username:
            raise ValueError('Confirma la eliminación escribiendo exactamente el nombre del usuario.')
        if set(recipes) - {'check', 'delete_user'}:
            raise ValueError('Ejecuta la eliminación por separado de las recetas de configuración.')
        if not isinstance(body.get('delete_home', False), bool):
            raise ValueError('La opción de borrar el home debe ser booleana.')
    jdk = str(body.get('jdk', '21'))
    if not re.fullmatch(r'[0-9]{1,2}', jdk):
        raise ValueError('La versión de JDK debe ser un número, por ejemplo 21.')
    extensions = body.get('extensions', [])
    if not isinstance(extensions, list) or len(extensions) > 100 or any(not isinstance(e, str) or not re.fullmatch(r'[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+', e) for e in extensions):
        raise ValueError('Extensiones inválidas: usa editor.extension, una por línea.')
    settings = body.get('settings', {})
    if not isinstance(settings, dict):
        raise ValueError('settings.json debe contener un objeto JSON.')
    folders = body.get('folders', [])
    if not isinstance(folders, list) or len(folders) > 30:
        raise ValueError('Lista de carpetas inválida.')
    if 'folders' in recipes and not folders:
        raise ValueError('Introduce al menos una carpeta de origen.')
    resolved = []
    for folder in folders:
        path = Path(folder).expanduser().resolve()
        if not path.is_dir() or path == Path('/') or path.name.startswith('.'):
            raise ValueError('Carpeta de origen inválida o inexistente: ' + str(folder))
        resolved.append(str(path))
    if len({Path(p).name for p in resolved}) != len(resolved):
        raise ValueError('Las carpetas de origen deben tener nombres distintos.')
    key = body.get('private_key', '').strip()
    if key:
        key = str(Path(key).expanduser().resolve())
        if not Path(key).is_file():
            raise ValueError('No existe la clave privada local indicada.')
    return hosts, recipes, jdk, extensions, settings, resolved, key


def redact_text(value, secret_values=()):
    text = str(value)
    for secret in sorted((str(v) for v in secret_values if v), key=len, reverse=True):
        text = text.replace(secret, '[OCULTO]')
    text = re.sub(r'(?i)((?:password|passwd|token|secret|authorization)\s*[=:]\s*)([^\s,;]+)',
                  r'\1[OCULTO]', text)
    text = re.sub(r'(https?://[^\s/:]+:)[^@\s]+@', r'\1[OCULTO]@', text)
    return text[:16000] + ('\n[Salida recortada]' if len(text) > 16000 else '')


def result_details(result, secret_values=()):
    if result.get('_ansible_no_log') or 'censored' in result:
        return {'msg': 'Salida oculta por no_log de Ansible.'}
    detail = {}
    for key in ('msg', 'stdout', 'stderr', 'exception'):
        if result.get(key):
            detail[key] = redact_text(result[key], secret_values)
    if 'rc' in result:
        detail['rc'] = result['rc']
    # Los módulos ejecutados en bucle devuelven errores por elemento.
    if isinstance(result.get('results'), list):
        detail['results'] = [result_details(r, secret_values) for r in result['results'][:100] if isinstance(r, dict)]
    return detail


def start_run(body):
    globals_snapshot = global_variables()
    for variable, field in GLOBAL_FIELDS.items():
        relevant = {'folders': 'folders', 'extensions': 'vscode', 'settings': 'vscode'}.get(field)
        has_custom = any(str(recipe).startswith('custom_') for recipe in body.get('recipes', []))
        fallback = globals_snapshot[variable] if not relevant or relevant in body.get('recipes', []) or has_custom else ([] if field != 'settings' else {})
        body.setdefault(field, fallback)
    hosts, recipes, jdk, extensions, settings, folders, key = validate_run(body)
    port = port_value(body.get('port', 22))
    # Instantánea: las recetas seleccionadas quedan fijadas al iniciar el trabajo.
    custom = {r['id']: r for r in custom_recipes()}
    chosen_custom = [custom[r] for r in dict.fromkeys(recipes) if r in custom]
    import ansible_runner
    from passlib.hash import sha512_crypt
    # Hash local: la contraseña de la nueva cuenta no se entrega en claro a Ansible.
    password_hash = sha512_crypt.hash(body['target_password']) if 'user' in recipes else ''
    body.pop('target_password', None)
    job_id = secrets.token_hex(8)
    job = {'recipes': [custom[r]['name'] if r in custom else r for r in recipes], 'id': job_id, 'status': 'running', 'events': [], 'stats': {}, 'cancel': False, 'hosts': hosts}
    with LOCK:
        if any(j['status'] == 'running' for j in JOBS.values()):
            raise ValueError('Ya hay una ejecución activa. Espera o cancélala.')
        JOBS[job_id] = job
        if len(JOBS) > 20:
            del JOBS[next(iter(JOBS))]
    def run():
        try:
            # Runner requiere archivos temporales privados. Se borran al terminar.
            with tempfile.TemporaryDirectory(prefix='aula-') as temp:
                os.chmod(temp, 0o700)
                project = Path(temp) / 'project'
                shutil.copytree(ROOT / 'playbooks', project)
                # El archivo coordinador temporal importa solo los playbooks seleccionados.
                order = ['check', 'user', 'java', 'vscode', 'folders', 'delete_user']
                selected = [name for name in order if name in recipes or name == 'check']
                plays = [{'ansible.builtin.import_playbook': name + '.yml'} for name in selected]
                for recipe in chosen_custom:
                    if not re.fullmatch(r'custom_[a-f0-9]{16}', recipe['id']):
                        raise ValueError('Identificador de receta no válido.')
                    filename = recipe['id'] + '.yml'
                    (project / filename).write_text(yaml.safe_dump([recipe_play(recipe)], sort_keys=False), encoding='utf-8')
                    plays.append({'ansible.builtin.import_playbook': filename})
                (project / 'site.yml').write_text(yaml.safe_dump(plays, sort_keys=False), encoding='utf-8')
                (project / 'vars/global.yml').write_text(yaml.safe_dump(globals_snapshot, sort_keys=False), encoding='utf-8')
                extra = {**globals_snapshot,
                    'ansible_user': body['ssh_user'],
                    'ansible_ssh_common_args': '-o StrictHostKeyChecking=yes -o ConnectTimeout=8',
                    'aula_user': body.get('target_user', ''), 'aula_password_hash': password_hash,
                    'aula_reset_password': bool(body.get('reset_password', False)),
                    'aula_jdk': jdk, 'aula_extensions': extensions, 'aula_settings': settings,
                    'aula_folders': folders,
                    'aula_delete_user': body.get('delete_username', ''),
                    'aula_delete_home': body.get('delete_home', False),
                }
                if body.get('ssh_password'):
                    extra['ansible_password'] = body['ssh_password']
                if body.get('sudo_password'):
                    extra['ansible_become_password'] = body['sudo_password']
                if key:
                    extra['ansible_ssh_private_key_file'] = key
                secret_values = [body.get(k) for k in ('ssh_password', 'sudo_password')] + [password_hash]
                def event(event):
                    kind = event.get('event', '')
                    data = event.get('event_data', {})
                    with LOCK:
                        if kind == 'playbook_on_stats':
                            job['stats'] = {k: data.get(k, {}) for k in ('ok', 'changed', 'failures', 'dark', 'skipped')}
                        elif kind in ('runner_on_ok', 'runner_on_failed', 'runner_on_unreachable', 'runner_on_skipped', 'runner_on_async_failed'):
                            host = data.get('host', '')
                            mapping = {'pc_' + ip.replace('.', '_'): ip for ip in hosts}
                            task_result = data.get('res', {})
                            job['events'].append({'host': host, 'ip': mapping.get(host, host),
                                                  'task': redact_text(data.get('task', ''), secret_values),
                                                  'time': event.get('created', ''),
                                                  'state': 'failed' if kind == 'runner_on_async_failed' else kind.replace('runner_on_', ''),
                                                  'changed': bool(task_result.get('changed')),
                                                  'details': result_details(task_result, secret_values)})
                    return False  # No persistir eventos completos de Runner.
                result = ansible_runner.run(
                    private_data_dir=temp, project_dir=str(project), playbook='site.yml',
                    inventory=inventory(hosts, port), extravars=extra,
                    tags=','.join(dict.fromkeys(['always'] + recipes)),
                    quiet=True, event_handler=event,
                    cancel_callback=lambda: job['cancel'],
                    envvars={'ANSIBLE_HOST_KEY_CHECKING': 'True', 'ANSIBLE_NOCOLOR': '1',
                             'ANSIBLE_DISPLAY_ARGS_TO_STDOUT': 'False', 'ANSIBLE_LOG_PATH': '/dev/null'},
                    settings={'job_timeout': 3600, 'idle_timeout': 600})
                with LOCK:
                    job['status'] = 'canceled' if job['cancel'] else ('successful' if result.rc == 0 else 'failed')
                    job['rc'] = result.rc
                    if result.rc and not any(e['state'] in ('failed', 'unreachable') for e in job['events']):
                        try:
                            with result.stdout as output:
                                job['diagnostic'] = redact_text(output.read()[-16000:], secret_values)
                        except (OSError, AttributeError):
                            job['diagnostic'] = 'Ansible no devolvió un resultado por equipo. Revisa la sintaxis y las dependencias.'
        except Exception:
            with LOCK:
                job['status'] = 'failed'
                job['error'] = 'No se pudo completar la ejecución. Revisa requisitos, acceso SSH/sudo y recetas. No se muestran mensajes que puedan contener credenciales.'
        finally:
            body.clear()
    threading.Thread(target=run, daemon=True).start()
    return {'id': job_id}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_json(self, value, code=200):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(data)

    def local_request(self):
        return self.headers.get('Host') in {'127.0.0.1:8765', 'localhost:8765'}

    def send_asset(self):
        # Solo archivos compilados con nombres generados; nunca rutas del usuario.
        name = self.path.removeprefix('/assets/')
        if not name or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.' for c in name) or '/' in name or '..' in name:
            self.send_error(404)
            return
        path = ROOT / 'web' / 'dist' / 'assets' / name
        content_type = {'.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2'}.get(path.suffix)
        if not content_type or not path.is_file():
            self.send_error(404)
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self.local_request():
            return self.send_json({'error': 'Host no permitido'}, 403)
        if self.path == '/':
            data = (ROOT / 'web/dist/index.html').read_text().replace('__TOKEN__', TOKEN).replace('__MODE__', 'application').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'")
            self.end_headers()
            self.wfile.write(data)
        elif self.path.startswith('/assets/'):
            self.send_asset()
        elif self.path == '/api/globals':
            try:
                self.send_json(global_response())
            except ValueError as exc:
                self.send_json({'error': str(exc)}, 400)
        elif self.path == '/api/networks':
            try:
                self.send_json({'networks': local_networks()})
            except ValueError as exc:
                self.send_json({'error': str(exc)}, 400)
        elif self.path == '/api/recipes':
            self.send_json({'recipes': [{k: v for k, v in r.items() if k != 'tasks'} for r in custom_recipes()]})
        elif self.path == '/api/inventory':
            try:
                with LOCK:
                    path = DATA / 'hosts.yml'
                    exists = path.exists()
                    inv = yaml.safe_load(path.read_text(encoding='utf-8')) if exists else inventory([], 22)
                    entries = inv['all']['children']['aula']['hosts']
                    if not isinstance(entries, dict):
                        raise ValueError('Formato de inventario inválido')
                    hosts = valid_hosts([v['ansible_host'] for v in entries.values()]) if entries else []
                    port = port_value(next(iter(entries.values()), {}).get('ansible_port', 22))
                self.send_json({'exists': exists, 'hosts': hosts, 'port': port})
            except (OSError, UnicodeError, yaml.YAMLError, KeyError, TypeError, ValueError, AttributeError):
                self.send_json({'error': 'No se pudo leer hosts.yml. Revisa su formato o genera un inventario desde Equipos.'}, 400)
        elif self.path.startswith('/api/jobs/'):
            with LOCK:
                job = JOBS.get(self.path.rsplit('/', 1)[-1])
                self.send_json({k: v for k, v in job.items() if k != 'cancel'} if job else {'error': 'Ejecución no encontrada'}, 200 if job else 404)
        else:
            self.send_json({'error': 'No encontrado'}, 404)

    def do_POST(self):
        if not self.local_request() or self.headers.get('X-Aula-Token') != TOKEN:
            return self.send_json({'error': 'Petición no autorizada. Recarga la página.'}, 403)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 262144:
                raise ValueError('Petición demasiado grande o vacía.')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('Petición inválida.')
            if self.path == '/api/globals':
                self.send_json(save_global_variables(body.get('content')))
            elif self.path == '/api/recipes':
                self.send_json(add_recipe(body), 201)
            elif self.path == '/api/discover':
                port = port_value(body.get('port', 22))
                if body.get('cidr'):
                    self.send_json({'hosts': discover(body['cidr'], port)})
                else:
                    self.send_json(discover_local(body.get('network'), port))
            elif self.path == '/api/inventory':
                hosts = valid_hosts(body.get('hosts'))
                save_inventory(hosts, port_value(body.get('port', 22)))
                self.send_json({'saved': len(hosts)})
            elif self.path == '/api/run':
                self.send_json(start_run(body), 202)
            elif self.path.startswith('/api/cancel/'):
                with LOCK:
                    job = JOBS.get(self.path.rsplit('/', 1)[-1])
                    if not job:
                        raise ValueError('Ejecución no encontrada.')
                    job['cancel'] = True
                self.send_json({'cancel': True})
            else:
                self.send_json({'error': 'No encontrado'}, 404)
        except (ValueError, KeyError, TypeError, OSError) as exc:
            self.send_json({'error': str(exc)}, 400)
        except ImportError:
            self.send_json({'error': 'Faltan dependencias. Instala requirements.txt dentro del entorno virtual.'}, 500)
        except Exception:
            self.send_json({'error': 'Error interno. Revisa la configuración local.'}, 500)


if __name__ == '__main__':
    print('Aula Ansible: http://127.0.0.1:8765 — Ctrl+C para salir. No cierres durante una ejecución.')
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
