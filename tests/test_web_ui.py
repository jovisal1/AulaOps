"""Comprueba el transporte de la interfaz compilada sin abrir sockets."""
import io
import json
from pathlib import Path
import re
import tempfile
import unittest
from unittest.mock import Mock, patch
from test_app import aula
from test_delete_logs_install import bootstrap


class WebInterfaceTests(unittest.TestCase):
    def handler(self, cls, path, port):
        handler = cls.__new__(cls)
        handler.path = path
        handler.headers = {'Host': '127.0.0.1:' + str(port)}
        handler.wfile = io.BytesIO()
        handler.send_response = Mock()
        handler.send_header = Mock()
        handler.end_headers = Mock()
        handler.send_error = Mock()
        return handler

    def test_both_servers_inject_their_mode_and_session_token(self):
        for module, port, mode in [(aula, 8765, 'application'), (bootstrap, 8764, 'installer')]:
            with self.subTest(mode=mode):
                handler = self.handler(module.Handler, '/', port)
                handler.do_GET()
                html = handler.wfile.getvalue().decode()
                self.assertIn('content="' + mode + '"', html)
                self.assertIn(module.TOKEN, html)
                self.assertNotIn('__TOKEN__', html)
                self.assertIn('type="module"', html)
                headers = dict(call.args for call in handler.send_header.call_args_list)
                self.assertIn("script-src 'self'", headers['Content-Security-Policy'])
                self.assertEqual(headers['Cache-Control'], 'no-store')

    def test_compiled_assets_are_available_and_traversal_is_rejected(self):
        html = (aula.ROOT / 'web/dist/index.html').read_text()
        assets = re.findall(r'(?:src|href)="(/assets/[^" ]+)"', html)
        self.assertGreaterEqual(len(assets), 2)
        for module, port in [(aula, 8765), (bootstrap, 8764)]:
            for asset in assets:
                handler = self.handler(module.Handler, asset, port)
                handler.do_GET()
                handler.send_response.assert_called_once_with(200)
                self.assertGreater(len(handler.wfile.getvalue()), 0)
            for path in ['/assets/../app.py', '/assets/%2e%2e%2fapp.py', '/assets/nonexistent.js']:
                handler = self.handler(module.Handler, path, port)
                handler.do_GET()
                handler.send_error.assert_called_once_with(404)
                self.assertEqual(handler.wfile.getvalue(), b'')

    def test_inventory_distinguishes_missing_saved_empty_and_invalid_files(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(aula, 'DATA', Path(tmp)):
            def get():
                handler = self.handler(aula.Handler, '/api/inventory', 8765)
                handler.do_GET()
                return handler, json.loads(handler.wfile.getvalue())
            _, data = get()
            self.assertEqual(data, {'exists': False, 'hosts': [], 'port': 22})
            aula.save_inventory(['192.168.1.2'], 2222)
            _, data = get()
            self.assertEqual(data, {'exists': True, 'hosts': ['192.168.1.2'], 'port': 2222})
            aula.save_inventory([], 22)
            _, data = get()
            self.assertTrue(data['exists'])
            self.assertEqual(data['hosts'], [])
            for content in ['not: [valid', 'null', 'all: {}']:
                (Path(tmp) / 'hosts.yml').write_text(content)
                handler, data = get()
                handler.send_response.assert_called_once_with(400)
                self.assertIn('hosts.yml', data['error'])

    def test_assets_retain_local_host_protection(self):
        for module, port in [(aula, 8765), (bootstrap, 8764)]:
            handler = self.handler(module.Handler, '/assets/index.js', port)
            handler.headers['Host'] = 'untrusted.example'
            handler.do_GET()
            handler.send_response.assert_called_once_with(403)
