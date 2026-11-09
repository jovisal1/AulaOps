import importlib.util
from pathlib import Path
import tempfile
import shutil
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('vscode_sources', Path(__file__).parents[1] / 'playbooks/files/normalize_vscode_sources.py')
sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sources)


class VscodeSourcesTests(unittest.TestCase):
    def test_legacy_and_deb822_duplicates_backed_up_and_other_sources_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'sources.list.d').mkdir()
            original_main = 'deb http://archive.ubuntu.com/ubuntu jammy main\ndeb https://packages.microsoft.com/repos/code stable main\n'
            (root / 'sources.list').write_text(original_main)
            legacy = root / 'sources.list.d/code.list'
            legacy.write_text('# conservar comentario\ndeb [signed-by=/otra/clave.gpg] https://packages.microsoft.com/repos/code/ stable main\n')
            deb822 = root / 'sources.list.d/vendor.sources'
            deb822.write_text('Types: deb\nURIs: https://packages.microsoft.com/repos/code https://other.example/repo\nSuites: stable testing\nComponents: main\nSigned-By: /old/key.gpg\n\nTypes: deb\nURIs: https://other.example/second\nSuites: stable\nComponents: main\n')
            result = sources.normalize(root, 'amd64')
            self.assertTrue(result['changed'])
            self.assertEqual((root / 'sources.list').read_text(), 'deb http://archive.ubuntu.com/ubuntu jammy main\n')
            self.assertEqual(legacy.read_text(), '# conservar comentario\n')
            self.assertIn('URIs: https://other.example/repo\nSuites: stable testing', deb822.read_text())
            self.assertIn('URIs: https://packages.microsoft.com/repos/code\nSuites: testing', deb822.read_text())
            self.assertIn('https://other.example/second', deb822.read_text())
            canonical = (root / 'sources.list.d/aula-vscode.list').read_text()
            self.assertIn('signed-by=/etc/apt/keyrings/aula-microsoft.asc', canonical)
            self.assertEqual(canonical.count('https://packages.microsoft.com/repos/code'), 1)
            backups = list(root.glob('sources.list.aulaops-backup-*'))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_text(), original_main)
            self.assertFalse(sources.normalize(root, 'amd64')['changed'])

    def test_deb822_multiline_and_embedded_key_keep_unrelated_stanza(self):
        other = 'Types: deb\nURIs: https://packages.microsoft.com/repos/edge\nSuites: stable\nSigned-By:\n -----BEGIN PGP PUBLIC KEY BLOCK-----\n abcdef\n -----END PGP PUBLIC KEY BLOCK-----\n'
        code = 'Types: deb\nURIs:\n https://packages.microsoft.com/repos/code/\nSuites: stable\nSigned-By: /old/key.gpg\n'
        cleaned = sources.clean_sources(code + '\n' + other)
        self.assertNotIn('/repos/code', cleaned)
        self.assertIn(other, cleaned)

    def test_dry_run_and_canonical_file_preserve_other_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'sources.list.d/aula-vscode.list'
            path.parent.mkdir()
            other = 'deb https://other.example/repo stable main\n'
            path.write_text(other)
            self.assertTrue(sources.normalize(root, 'arm64', check=True)['changed'])
            self.assertEqual(path.read_text(), other)
            self.assertEqual(list(root.rglob('*.aulaops-backup-*')), [])
            sources.normalize(root, 'arm64')
            self.assertTrue(path.read_text().startswith(other))
            self.assertIn('arch=arm64', path.read_text())
            self.assertFalse(sources.normalize(root, 'arm64')['changed'])

    def test_only_exact_vscode_stable_entries_are_removed(self):
        content = ('# deb https://packages.microsoft.com/repos/code stable main\n'
                   'deb https://packages.microsoft.com/repos/code-insiders stable main\n'
                   'deb https://packages.microsoft.com.evil.example/repos/code stable main\n'
                   'deb https://packages.microsoft.com/repos/code testing main\n')
        self.assertEqual(sources.clean_list(content), content)

    @unittest.skipUnless(shutil.which('apt-cache'), 'APT no está disponible')
    def test_real_apt_parser_accepts_normalized_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parts = root / 'sources.list.d'
            parts.mkdir()
            (root / 'sources.list').write_text('')
            (parts / 'old.list').write_text('deb https://packages.microsoft.com/repos/code stable main\n')
            (parts / 'aula-vscode.list').write_text('deb [signed-by=/etc/apt/keyrings/aula-microsoft.asc] https://packages.microsoft.com/repos/code stable main\n')
            (root / 'lists/partial').mkdir(parents=True)
            (root / 'cache').mkdir()
            command = ['apt-cache', '-o', 'Dir::Etc::sourcelist=' + str(root / 'sources.list'),
                       '-o', 'Dir::Etc::sourceparts=' + str(parts),
                       '-o', 'Dir::State::lists=' + str(root / 'lists'),
                       '-o', 'Dir::Cache=' + str(root / 'cache'), 'policy']
            before = subprocess.run(command, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(before.returncode, 0)
            self.assertIn('Signed-By', before.stderr)
            sources.normalize(root, 'amd64')
            after = subprocess.run(command, capture_output=True, text=True, timeout=10)
            self.assertEqual(after.returncode, 0, after.stderr)
            self.assertNotIn('Conflicting values', after.stderr)
