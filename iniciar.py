#!/usr/bin/env python3
"""Lanzador e instalador local: solo biblioteca estándar de Python."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
VENV = ROOT / '.venv'
TOKEN = secrets.token_urlsafe(32)
LOCK = threading.RLock()
STATE = {'status': 'idle', 'log': [], 'error': ''}
PROCESS = None
PACKAGES = ['python3-venv', 'openssh-client', 'sshpass', 'iproute2']


def dependency_status():
    missing = []
    for binary in ('ssh', 'sshpass', 'ip'):
        if not shutil.which(binary):
            missing.append(binary)
    python = VENV / 'bin/python'
    digest = hashlib.sha256((ROOT / 'requirements.txt').read_bytes()).hexdigest()
    if not python.exists():
        missing.append('Entorno virtual de Python y Ansible')
    else:
        try:
            check = subprocess.run([str(python), '-c', 'import ansible, ansible_runner, yaml, passlib.hash'],
                                   capture_output=True, timeout=20)
            if check.returncode or not (VENV / 'bin/ansible-playbook').exists():
                missing.append('Dependencias Python de la aplicación')
        except (OSError, subprocess.TimeoutExpired):
            missing.append('Entorno Python no disponible')
    stamp = VENV / '.aula-requirements-sha256'
    if not stamp.exists() or stamp.read_text().strip() != digest:
        missing.append('Preparación de las versiones de requirements.txt')
    return {'ready': not missing, 'missing': missing}


def run_command(args, sudo_password='', privileged=False):
    if privileged:
        args = ['sudo', '-S', '-p', ''] + args if sudo_password else ['sudo', '-n'] + args
    # Nunca incluir contraseña en argumentos, archivos, logs ni variables de entorno.
    result = subprocess.run(args, input=(sudo_password+'\n') if privileged and sudo_password else '',
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            cwd=ROOT, timeout=1800)
    output = result.stdout
    if sudo_password:
        output = output.replace(sudo_password, '[OCULTO]')
    with LOCK:
        STATE['log'].append(output[-12000:])
    if result.returncode:
        raise RuntimeError('Un paso de instalación ha fallado. Revisa el registro y vuelve a intentarlo.')


def install(password):
    try:
        if os.geteuid() == 0:
            raise RuntimeError('Inicia el lanzador con tu usuario normal, sin sudo.')
        if not shutil.which('apt-get') or not shutil.which('sudo'):
            raise RuntimeError('La instalación automática requiere LliureX/Debian con apt-get y sudo.')
        with LOCK:
            STATE['log'].append('1/4 · Actualizando índices de paquetes…')
        run_command(['env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'update'], password, True)
        with LOCK:
            STATE['log'].append('2/4 · Instalando Python venv, cliente SSH y sshpass…')
        run_command(['env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get', 'install', '-y', '-o', 'Dpkg::Options::=--force-confdef', '-o', 'Dpkg::Options::=--force-confold'] + PACKAGES, password, True)
        password = ''
        with LOCK:
            STATE['log'].append('3/4 · Preparando el entorno virtual local…')
        run_command([sys.executable, '-m', 'venv', str(VENV)])
        with LOCK:
            STATE['log'].append('4/4 · Instalando Ansible y las dependencias de la aplicación…')
        run_command([str(VENV / 'bin/python'), '-m', 'pip', 'install', '-r', str(ROOT / 'requirements.txt')])
        digest = hashlib.sha256((ROOT / 'requirements.txt').read_bytes()).hexdigest()
        (VENV / '.aula-requirements-sha256').write_text(digest)
        status = dependency_status()
        if not status['ready']:
            raise RuntimeError('La instalación terminó pero faltan: ' + ', '.join(status['missing']))
        with LOCK:
            STATE['status'] = 'successful'
            STATE['log'].append('Instalación completada. Ya puedes abrir Aula Ansible.')
    except subprocess.TimeoutExpired:
        with LOCK:
            STATE.update(status='failed', error='Un paso ha superado los 30 minutos. Comprueba la conexión y APT antes de reintentar.')
    except Exception as exc:
        message = str(exc).replace(password, '[OCULTO]') if password else str(exc)
        with LOCK:
            STATE.update(status='failed', error=message)
    finally:
        password = ''


def start_application():
    global PROCESS
    if STATE['status'] == 'installing':
        raise ValueError('Espera a que termine la instalación.')
    if not dependency_status()['ready']:
        raise ValueError('Primero completa la instalación de dependencias.')
    with LOCK:
        if PROCESS and PROCESS.poll() is None:
            return
        # No lanzar otra copia sobre el puerto de una aplicación que ya está abierta.
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', 8765)) == 0:
                raise ValueError('El puerto 8765 ya está ocupado. Si Aula Ansible ya está abierta, úsala; de lo contrario cierra el proceso que lo ocupa.')
        PROCESS = subprocess.Popen([str(VENV / 'bin/python'), str(ROOT / 'app.py')], cwd=ROOT,
                                   env={**os.environ, 'PATH': str(VENV / 'bin') + os.pathsep + os.environ.get('PATH', '')})


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, data, code=200, html=False):
        raw = data.encode() if html else json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8' if html else 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(raw)

    def allowed(self):
        return self.headers.get('Host') in {'127.0.0.1:8764', 'localhost:8764'}

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
        if not self.allowed():
            return self.respond({'error': 'Host no permitido'}, 403)
        if self.path == '/':
            return self.respond((ROOT / 'web/dist/index.html').read_text().replace('__TOKEN__', TOKEN).replace('__MODE__', 'installer'), html=True)
        if self.path.startswith('/assets/'):
            return self.send_asset()
        if self.path == '/status':
            with LOCK:
                snapshot = {**STATE, 'log': list(STATE['log'])}
            snapshot.update(dependency_status())
            return self.respond(snapshot)
        self.respond({'error': 'No encontrado'}, 404)

    def do_POST(self):
        if not self.allowed() or self.headers.get('X-Aula-Token') != TOKEN:
            return self.respond({'error': 'Petición no autorizada'}, 403)
        try:
            size = int(self.headers.get('Content-Length', 0))
            if not 0 < size <= 8192:
                raise ValueError('Petición inválida')
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError('Petición inválida')
            if self.path == '/install':
                password = body.pop('password', '')
                if not isinstance(password, str) or '\n' in password:
                    raise ValueError('Contraseña no válida')
                with LOCK:
                    if STATE['status'] == 'installing':
                        raise ValueError('La instalación ya está en curso.')
                    STATE.update(status='installing', log=[], error='')
                threading.Thread(target=install, args=(password,), daemon=True).start()
                self.respond({'started': True}, 202)
            elif self.path == '/open':
                start_application()
                self.respond({'url': 'http://127.0.0.1:8765'})
            else:
                self.respond({'error': 'No encontrado'}, 404)
        except (ValueError, TypeError, OSError):
            self.respond({'error': 'No se pudo iniciar la acción. Comprueba las dependencias, el puerto y que no haya otra instalación en curso.'}, 400)


if __name__ == '__main__':
    print('Preparación de Aula Ansible: http://127.0.0.1:8764 · Mantén esta terminal abierta.')
    server = ThreadingHTTPServer(('127.0.0.1', 8764), Handler)
    webbrowser.open('http://127.0.0.1:8764')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nLanzador detenido. Si una tarea sigue activa en Aula Ansible, espera a que termine antes de cerrar su proceso.')
    finally:
        server.server_close()
