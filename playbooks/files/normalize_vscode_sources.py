#!/usr/bin/env python3
"""Normalize only the stable Microsoft Code source; no APT/python-apt required."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import uuid
from urllib.parse import urlsplit


def is_code_uri(uri):
    parsed = urlsplit(uri)
    return (parsed.scheme in ('http', 'https') and
            parsed.netloc.lower() == 'packages.microsoft.com' and
            parsed.path.rstrip('/') == '/repos/code' and
            not parsed.query and not parsed.fragment)


def clean_list(content):
    result = []
    for line in content.splitlines(keepends=True):
        match = re.match(r'^\s*deb(?:-src)?\s+(?:\[[^\]]*\]\s+)?(\S+)\s+(\S+)', line)
        if match and is_code_uri(match[1]) and match[2] == 'stable':
            continue
        result.append(line)
    return ''.join(result)


def field_pattern(name):
    return re.compile(r'^' + re.escape(name) + r':[^\n]*(?:\n[ \t]+[^\n]*)*', re.M | re.I)


def field_values(stanza, name):
    match = field_pattern(name).search(stanza)
    return match[0].split(':', 1)[1].split() if match else []


def set_field(stanza, name, values):
    return field_pattern(name).sub(lambda _: name + ': ' + ' '.join(values), stanza, count=1)


def clean_sources(content):
    parts = re.split(r'(\n[ \t]*\n)', content)
    for index in range(0, len(parts), 2):
        stanza = parts[index]
        uris, suites = field_values(stanza, 'URIs'), field_values(stanza, 'Suites')
        if not any(is_code_uri(uri) for uri in uris) or 'stable' not in suites:
            continue
        # A mixed stanza may describe other URIs or suites: keep both intact.
        kept = []
        other_uris = [uri for uri in uris if not is_code_uri(uri)]
        if other_uris:
            kept.append(set_field(stanza, 'URIs', other_uris))
        other_suites = [suite for suite in suites if suite != 'stable']
        if other_suites:
            only_code = set_field(stanza, 'URIs', [uri for uri in uris if is_code_uri(uri)])
            kept.append(set_field(only_code, 'Suites', other_suites))
        if not kept:
            # Preserve standalone comments, including provenance notes.
            kept = ['\n'.join(line for line in stanza.splitlines() if line.lstrip().startswith('#'))]
        parts[index] = '\n\n'.join(kept)
    return ''.join(parts)


def write_with_backup(path, content, check=False):
    old = path.read_text(encoding='utf-8') if path.exists() else None
    if old == content:
        return False
    if check:
        return True
    target = path.resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    permissions = target.stat().st_mode & 0o777 if target.exists() else 0o644
    if target.exists():
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        shutil.copy2(target, str(target) + '.aulaops-backup-' + stamp + '-' + uuid.uuid4().hex[:8])
    descriptor, temporary = tempfile.mkstemp(prefix='.aulaops-', dir=str(target.parent))
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, permissions)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return True


def normalize(apt_root, architecture, check=False):
    apt_root = Path(apt_root)
    canonical = apt_root / 'sources.list.d/aula-vscode.list'
    paths = [apt_root / 'sources.list']
    paths += sorted((apt_root / 'sources.list.d').glob('*.list'))
    paths += sorted((apt_root / 'sources.list.d').glob('*.sources'))
    changes = {}
    for path in paths:
        if not path.is_file():
            continue
        original = path.read_text(encoding='utf-8')
        changes[path] = clean_sources(original) if path.suffix == '.sources' else clean_list(original)
    content = changes.get(canonical, '')
    if content and not content.endswith('\n'):
        content += '\n'
    content += ('deb [arch=' + architecture + ' signed-by=/etc/apt/keyrings/aula-microsoft.asc] '
                'https://packages.microsoft.com/repos/code stable main\n')
    changes[canonical] = content
    changed = [str(path) for path, content in changes.items() if write_with_backup(path, content, check)]
    return {'changed': bool(changed), 'files': changed}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apt-root', default='/etc/apt')
    parser.add_argument('--architecture', choices=['amd64', 'arm64'], required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    print(json.dumps(normalize(args.apt_root, args.architecture, args.check)))
